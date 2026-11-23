"""
chest_xray/train.py
Full two-phase fine-tuning pipeline for the DenseNet121 TB classifier.

Usage:
    python train.py --data_dir /path/to/dataset --epochs_p1 5 --epochs_p2 5

Dataset structure expected:
    data_dir/
        train/
            TB/
            Normal/
        val/
            TB/
            Normal/

If no val/ folder is present the script auto-splits train 80/20.
"""

import argparse
import os
import copy
import time

import torch
import torch.nn as nn
from torch.optim import Adam
from torch.optim.lr_scheduler import ReduceLROnPlateau
from torch.utils.data import DataLoader, random_split
from torchvision import datasets, transforms

from chest_xray.model import build_model

# ── Hyperparameters ──────────────────────────────────────────────────────────

DEFAULTS = dict(
    data_dir="data",
    save_path="weights/densenet121_tb.pth",
    img_size=224,
    batch_size=32,
    epochs_p1=5,       # Phase 1: classifier only
    epochs_p2=5,       # Phase 2: last denseblock + classifier
    lr_p1=1e-3,
    lr_p2=1e-5,
    patience=3,        # early stopping patience
    num_workers=4,
    seed=42,
)

# ── Transforms ───────────────────────────────────────────────────────────────

def get_transforms(img_size: int):
    train_tf = transforms.Compose([
        transforms.Resize((img_size + 20, img_size + 20)),
        transforms.RandomCrop(img_size),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(10),
        transforms.ColorJitter(brightness=0.2, contrast=0.2),
        transforms.Grayscale(num_output_channels=3),   # ensure 3-channel
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406],
                             [0.229, 0.224, 0.225]),
    ])
    val_tf = transforms.Compose([
        transforms.Resize((img_size, img_size)),
        transforms.Grayscale(num_output_channels=3),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406],
                             [0.229, 0.224, 0.225]),
    ])
    return train_tf, val_tf


# ── Dataset Loading ──────────────────────────────────────────────────────────

def load_datasets(data_dir: str, img_size: int, seed: int):
    train_tf, val_tf = get_transforms(img_size)
    train_dir = os.path.join(data_dir, "train")
    val_dir   = os.path.join(data_dir, "val")

    if os.path.exists(val_dir):
        train_ds = datasets.ImageFolder(train_dir, transform=train_tf)
        val_ds   = datasets.ImageFolder(val_dir,   transform=val_tf)
    else:
        full_ds = datasets.ImageFolder(train_dir, transform=train_tf)
        n_val   = int(0.2 * len(full_ds))
        n_train = len(full_ds) - n_val
        g = torch.Generator().manual_seed(seed)
        train_ds, val_ds = random_split(full_ds, [n_train, n_val], generator=g)
        # Re-apply val transforms to val split
        val_ds.dataset = copy.deepcopy(full_ds)
        val_ds.dataset.transform = val_tf

    print(f"Train samples: {len(train_ds)} | Val samples: {len(val_ds)}")
    return train_ds, val_ds


# ── Training Loop ────────────────────────────────────────────────────────────

def run_epoch(model, loader, criterion, optimizer, device, is_train: bool):
    model.train(is_train)
    total_loss = 0.0
    correct = 0
    total = 0

    with torch.set_grad_enabled(is_train):
        for imgs, labels in loader:
            imgs   = imgs.to(device)
            labels = labels.float().unsqueeze(1).to(device)

            logits = model(imgs)
            loss   = criterion(logits, labels)

            if is_train:
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()

            total_loss += loss.item() * imgs.size(0)
            preds  = (torch.sigmoid(logits) > 0.5).float()
            correct += (preds == labels).sum().item()
            total  += imgs.size(0)

    return total_loss / total, correct / total


# ── Early Stopping ────────────────────────────────────────────────────────────

class EarlyStopper:
    def __init__(self, patience: int):
        self.patience  = patience
        self.counter   = 0
        self.best_loss = float("inf")
        self.best_weights = None

    def step(self, val_loss: float, model) -> bool:
        if val_loss < self.best_loss - 1e-4:
            self.best_loss    = val_loss
            self.best_weights = copy.deepcopy(model.state_dict())
            self.counter      = 0
        else:
            self.counter += 1
        return self.counter >= self.patience


# ── Main Training Function ────────────────────────────────────────────────────

def train(args):
    torch.manual_seed(args.seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    os.makedirs(os.path.dirname(args.save_path) or ".", exist_ok=True)

    train_ds, val_ds = load_datasets(args.data_dir, args.img_size, args.seed)

    train_loader = DataLoader(train_ds, batch_size=args.batch_size,
                              shuffle=True,  num_workers=args.num_workers,
                              pin_memory=True)
    val_loader   = DataLoader(val_ds,   batch_size=args.batch_size,
                              shuffle=False, num_workers=args.num_workers,
                              pin_memory=True)

    model     = build_model(pretrained=True).to(device)
    criterion = nn.BCEWithLogitsLoss()
    stopper   = EarlyStopper(args.patience)

    # ── Phase 1: Train classifier only ──────────────────────────────────────
    print("\n=== Phase 1: Classifier-only training ===")
    model.freeze_backbone()
    print(f"Trainable params: {model.get_trainable_params():,} / {model.get_total_params():,}")

    optimizer = Adam(filter(lambda p: p.requires_grad, model.parameters()),
                     lr=args.lr_p1)
    scheduler = ReduceLROnPlateau(optimizer, patience=2, factor=0.5)

    for epoch in range(1, args.epochs_p1 + 1):
        t0 = time.time()
        tr_loss, tr_acc = run_epoch(model, train_loader, criterion, optimizer, device, is_train=True)
        vl_loss, vl_acc = run_epoch(model, val_loader,   criterion, None,      device, is_train=False)
        scheduler.step(vl_loss)
        print(f"  Epoch {epoch:02d} | "
              f"Train Loss {tr_loss:.4f} Acc {tr_acc:.3f} | "
              f"Val Loss {vl_loss:.4f} Acc {vl_acc:.3f} | "
              f"Time {time.time()-t0:.1f}s")
        if stopper.step(vl_loss, model):
            print("  Early stopping triggered.")
            break

    model.load_state_dict(stopper.best_weights)

    # ── Phase 2: Fine-tune last DenseBlock ───────────────────────────────────
    print("\n=== Phase 2: Fine-tuning last DenseBlock + classifier ===")
    model.unfreeze_last_denseblock()
    print(f"Trainable params: {model.get_trainable_params():,} / {model.get_total_params():,}")

    optimizer = Adam(filter(lambda p: p.requires_grad, model.parameters()),
                     lr=args.lr_p2)
    scheduler = ReduceLROnPlateau(optimizer, patience=2, factor=0.5)
    stopper   = EarlyStopper(args.patience)

    for epoch in range(1, args.epochs_p2 + 1):
        t0 = time.time()
        tr_loss, tr_acc = run_epoch(model, train_loader, criterion, optimizer, device, is_train=True)
        vl_loss, vl_acc = run_epoch(model, val_loader,   criterion, None,      device, is_train=False)
        scheduler.step(vl_loss)
        print(f"  Epoch {epoch:02d} | "
              f"Train Loss {tr_loss:.4f} Acc {tr_acc:.3f} | "
              f"Val Loss {vl_loss:.4f} Acc {vl_acc:.3f} | "
              f"Time {time.time()-t0:.1f}s")
        if stopper.step(vl_loss, model):
            print("  Early stopping triggered.")
            break

    model.load_state_dict(stopper.best_weights)

    # ── Save ─────────────────────────────────────────────────────────────────
    torch.save({
        "model_state_dict": model.state_dict(),
        "val_loss": stopper.best_loss,
        "args": vars(args),
    }, args.save_path)
    print(f"\nModel saved → {args.save_path}")


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train DenseNet121 TB Classifier")
    for k, v in DEFAULTS.items():
        parser.add_argument(f"--{k}", type=type(v), default=v)
    args = parser.parse_args()
    train(args)
