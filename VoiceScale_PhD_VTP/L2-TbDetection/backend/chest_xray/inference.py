"""
chest_xray/inference.py
Load trained DenseNet121 weights and run inference on a raw image buffer.
"""

import io
import os
import numpy as np
from PIL import Image

import torch

from chest_xray.model import build_model

# ── Config ────────────────────────────────────────────────────────────────────

WEIGHTS_PATH = os.environ.get(
    "XRAY_WEIGHTS", 
    os.path.join(os.path.dirname(__file__), "weights", "densenet121_tb.pth")
)
IMG_SIZE = 224
DEVICE   = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ── Pre-processing transform ──────────────────────────────────────────────────

try:
    from torchvision import transforms
    _torchvision_transform = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.Grayscale(num_output_channels=3),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406],
                             [0.229, 0.224, 0.225]),
    ])
    def _preprocess(image: Image.Image) -> torch.Tensor:
        return _torchvision_transform(image).unsqueeze(0).to(DEVICE)
except ImportError:
    def _preprocess(image: Image.Image) -> torch.Tensor:
        img = image.convert("RGB").resize((IMG_SIZE, IMG_SIZE))
        arr = np.array(img, dtype=np.float32) / 255.0
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        norm = (arr - mean) / std
        tensor = torch.from_numpy(norm.transpose(2, 0, 1)).unsqueeze(0).to(DEVICE)
        return tensor

# ── Lazy model loader (singleton) ────────────────────────────────────────────

_model = None

def _load_model() -> torch.nn.Module:
    global _model
    if _model is not None:
        return _model

    model = build_model(pretrained=False)

    if os.path.exists(WEIGHTS_PATH):
        ckpt = torch.load(WEIGHTS_PATH, map_location=DEVICE)
        state = ckpt.get("model_state_dict", ckpt)
        model.load_state_dict(state)
        print(f"[chest_xray] Loaded weights from {WEIGHTS_PATH}")
    else:
        # No trained weights → use ImageNet pretrained as a proxy (demo mode)
        model = build_model(pretrained=True)
        print("[chest_xray] WARNING: No trained weights found — running in demo mode.")

    model.to(DEVICE).eval()
    _model = model
    return _model


# ── Public API ────────────────────────────────────────────────────────────────

def predict_xray(image_bytes: bytes) -> dict:
    """
    Parameters
    ----------
    image_bytes : raw bytes of a JPEG or PNG file

    Returns
    -------
    dict with keys: tb_positive, confidence, probability, message
    """
    model = _load_model()

    if not image_bytes or len(image_bytes) < 16:
        raise ValueError("Empty or invalid image payload received.")

    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as e:
        raise ValueError(f"Failed to decode image: {e}")

    tensor = _preprocess(image)

    with torch.no_grad():
        logit    = model(tensor)
        prob     = torch.sigmoid(logit).item()

    tb_positive = prob >= 0.5
    confidence  = prob if tb_positive else (1.0 - prob)

    message = (
        "High probability of Tuberculosis detected in the chest X-ray. "
        "Please consult a specialist immediately."
    ) if tb_positive else (
        "No significant TB indicators detected in the chest X-ray. "
        "However, clinical correlation is always recommended."
    )

    return {
        "tb_positive": bool(tb_positive),
        "confidence": round(float(confidence) * 100, 2),
        "probability": round(float(prob) * 100, 2),
        "message": message,
    }
