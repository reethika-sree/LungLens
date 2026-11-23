"""
retrain_blood_model.py
--------------------------------------------------------------
Run this script ONCE from the backend folder to regenerate the
xgb_tb.pkl weights file using the current model.py Pipeline.

The old .pkl was saved with a 'SimpleBloodModel' class that no
longer exists, causing:
    "Can't get attribute 'SimpleBloodModel' on <module '__main__'>"

This script replaces it with a fresh sklearn Pipeline (StandardScaler
+ XGBoost) trained on synthetic blood-marker data.

Usage (run from the backend folder):
    cd VoiceCare-PHC/L2-TbDetection/backend
    python retrain_blood_model.py
"""

import os
import sys
import numpy as np
import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, classification_report
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from xgboost import XGBClassifier

# ── Output path ───────────────────────────────────────────────────────────────
SAVE_PATH = os.path.join(
    os.path.dirname(__file__),
    "blood_test", "weights", "xgb_tb.pkl"
)

# ── Healthy reference ranges ──────────────────────────────────────────────────
HEALTHY_RANGES = {
    "hemoglobin": (12.0, 17.5),
    "wbc_count":  (4.0,  11.0),
    "esr":        (0.0,  20.0),
    "crp":        (0.0,  10.0),
}

# ── Feature engineering (must match model.py exactly) ─────────────────────────
def engineer_features(hemoglobin, wbc_count, esr, crp):
    raw = np.array([hemoglobin, wbc_count, esr, crp], dtype=np.float32)
    flags = np.array([
        1.0 if not (HEALTHY_RANGES["hemoglobin"][0] <= hemoglobin <= HEALTHY_RANGES["hemoglobin"][1]) else 0.0,
        1.0 if not (HEALTHY_RANGES["wbc_count"][0]  <= wbc_count  <= HEALTHY_RANGES["wbc_count"][1])  else 0.0,
        1.0 if not (HEALTHY_RANGES["esr"][0]        <= esr        <= HEALTHY_RANGES["esr"][1])        else 0.0,
        1.0 if not (HEALTHY_RANGES["crp"][0]        <= crp        <= HEALTHY_RANGES["crp"][1])        else 0.0,
    ], dtype=np.float32)
    return np.concatenate([raw, flags])

# ── Synthetic data ─────────────────────────────────────────────────────────────
def generate_synthetic_data(n_samples=2000, seed=42):
    rng = np.random.default_rng(seed)
    n_tb     = n_samples // 2
    n_normal = n_samples - n_tb

    normal = pd.DataFrame({
        "hemoglobin": rng.normal(14.0, 1.5, n_normal).clip(10, 18),
        "wbc_count":  rng.normal(7.0,  1.5, n_normal).clip(3,  15),
        "esr":        rng.normal(10.0, 5.0, n_normal).clip(0,  30),
        "crp":        rng.normal(3.0,  2.0, n_normal).clip(0,  20),
        "label": 0,
    })
    tb = pd.DataFrame({
        "hemoglobin": rng.normal(10.5, 1.5, n_tb).clip(6,  15),
        "wbc_count":  rng.normal(11.5, 2.5, n_tb).clip(5,  20),
        "esr":        rng.normal(60.0, 20.0, n_tb).clip(10, 120),
        "crp":        rng.normal(45.0, 15.0, n_tb).clip(10, 120),
        "label": 1,
    })
    return pd.concat([normal, tb], ignore_index=True).sample(frac=1, random_state=seed)

# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("  Blood Test Model — Retraining")
    print("=" * 60)

    df = generate_synthetic_data()
    print(f"Generated {len(df)} synthetic samples")
    print(f"Class balance:\n{df['label'].value_counts().to_string()}\n")

    # Feature engineering
    X = np.vstack([
        engineer_features(r.hemoglobin, r.wbc_count, r.esr, r.crp)
        for _, r in df.iterrows()
    ])
    y = df["label"].values.astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )

    # Build pipeline (StandardScaler + XGBoost) — same as model.py build_pipeline()
    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("classifier", XGBClassifier(
            n_estimators=200,
            max_depth=4,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            eval_metric="logloss",
            random_state=42,
            n_jobs=-1,
            verbosity=0,
            enable_categorical=False,
        )),
    ])

    print("Training pipeline …")
    pipeline.fit(X_train, y_train)

    # Evaluate
    y_proba = pipeline.predict_proba(X_test)[:, 1]
    y_pred  = pipeline.predict(X_test)
    auc     = roc_auc_score(y_test, y_proba)
    print(f"\nTest ROC-AUC : {auc:.4f}")
    print(classification_report(y_test, y_pred, target_names=["Normal", "TB"]))

    # Save
    os.makedirs(os.path.dirname(SAVE_PATH), exist_ok=True)
    joblib.dump(pipeline, SAVE_PATH)
    print(f"\n✅  Saved new pipeline → {SAVE_PATH}")
    print("\nNow restart your uvicorn server and blood test will work!")

if __name__ == "__main__":
    main()
