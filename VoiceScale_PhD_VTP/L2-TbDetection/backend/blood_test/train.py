"""
blood_test/train.py
Train an XGBoost pipeline on structured blood-marker data for TB prediction.

Usage:
    python train.py --data_csv /path/to/blood_data.csv --save_path weights/xgb_tb.pkl

Expected CSV columns:
    hemoglobin, wbc_count, esr, crp, label  (label: 1=TB, 0=Normal)

If no CSV is supplied, a synthetic dataset is generated for demonstration.
"""

import argparse
import os
import numpy as np
import pandas as pd

from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.metrics import (
    classification_report, roc_auc_score, confusion_matrix
)

from .model import build_pipeline, save_pipeline, engineer_features, HEALTHY_RANGES


DEFAULTS = dict(
    data_csv="",
    save_path="weights/xgb_tb.pkl",
    test_size=0.2,
    seed=42,
    n_cv_folds=5,
)


# ── Synthetic data generator ──────────────────────────────────────────────────

def generate_synthetic_data(n_samples: int = 2000, seed: int = 42) -> pd.DataFrame:
    """
    Generates a plausible synthetic blood-test dataset for TB vs Normal.
    TB patients tend to have: low Hb, elevated WBC/ESR/CRP.
    """
    rng = np.random.default_rng(seed)
    n_tb     = n_samples // 2
    n_normal = n_samples - n_tb

    # Normal patients
    normal = pd.DataFrame({
        "hemoglobin": rng.normal(14.0, 1.5, n_normal).clip(10, 18),
        "wbc_count":  rng.normal(7.0,  1.5, n_normal).clip(3,  15),
        "esr":        rng.normal(10.0, 5.0, n_normal).clip(0,  30),
        "crp":        rng.normal(3.0,  2.0, n_normal).clip(0,  20),
        "label": 0,
    })

    # TB patients
    tb = pd.DataFrame({
        "hemoglobin": rng.normal(10.5, 1.5, n_tb).clip(6,  15),
        "wbc_count":  rng.normal(11.5, 2.5, n_tb).clip(5,  20),
        "esr":        rng.normal(60.0, 20.0, n_tb).clip(10, 120),
        "crp":        rng.normal(45.0, 15.0, n_tb).clip(10, 120),
        "label": 1,
    })

    df = pd.concat([normal, tb], ignore_index=True).sample(frac=1, random_state=seed)
    return df


# ── Feature preparation ───────────────────────────────────────────────────────

def prepare_features(df: pd.DataFrame):
    """Apply feature engineering to every row and return X, y."""
    X_list = []
    for _, row in df.iterrows():
        feats = engineer_features(
            hemoglobin=row["hemoglobin"],
            wbc_count=row["wbc_count"],
            esr=row["esr"],
            crp=row["crp"],
        )
        X_list.append(feats.flatten())
    X = np.vstack(X_list)
    y = df["label"].values.astype(int)  # Ensure labels are integers
    return X, y


# ── Training ──────────────────────────────────────────────────────────────────

def train(args):
    # 1. Load or generate dataset
    if args.data_csv and os.path.exists(args.data_csv):
        df = pd.read_csv(args.data_csv)
        print(f"Loaded dataset: {len(df)} samples from {args.data_csv}")
    else:
        print("No dataset supplied — generating synthetic data (2000 samples).")
        df = generate_synthetic_data(seed=args.seed)

    # 2. Handle missing values
    for col in ["hemoglobin", "wbc_count", "esr", "crp"]:
        median_val = df[col].median()
        n_missing  = df[col].isna().sum()
        if n_missing:
            df[col].fillna(median_val, inplace=True)
            print(f"  Imputed {n_missing} missing values in '{col}' with median {median_val:.2f}")

    print(f"Class distribution:\n{df['label'].value_counts().to_string()}\n")

    # 3. Feature engineering
    X, y = prepare_features(df)
    print(f"Feature matrix shape: {X.shape}")

    # 4. Train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=args.test_size, stratify=y, random_state=args.seed
    )

    # 5. Build and train pipeline
    pipeline = build_pipeline()

    print(f"\nRunning {args.n_cv_folds}-fold cross-validation …")
    cv_scores = cross_val_score(
        pipeline, X_train, y_train,
        cv=StratifiedKFold(n_splits=args.n_cv_folds, shuffle=True, random_state=args.seed),
        scoring="roc_auc", n_jobs=-1
    )
    print(f"  CV AUC: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

    print("\nFitting final model on full training set …")
    pipeline.fit(X_train, y_train)

    # 6. Evaluation on held-out test set
    y_pred  = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)[:, 1]
    auc     = roc_auc_score(y_test, y_proba)

    print("\n── Test-Set Evaluation ──────────────────────────────────────")
    print(f"  ROC-AUC : {auc:.4f}")
    print("\n  Classification Report:")
    print(classification_report(y_test, y_pred, target_names=["Normal", "TB"]))
    print("  Confusion Matrix:")
    print(confusion_matrix(y_test, y_pred))

    # 7. Save
    save_pipeline(pipeline, args.save_path)
    print(f"\nPipeline saved → {args.save_path}")


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train XGBoost Blood-Test TB Classifier")
    for k, v in DEFAULTS.items():
        parser.add_argument(f"--{k}", type=type(v) if v != "" else str, default=v)
    args = parser.parse_args()
    train(args)
