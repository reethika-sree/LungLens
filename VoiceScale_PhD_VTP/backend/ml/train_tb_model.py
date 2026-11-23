"""
VoiceCare PHC — TB Risk Model Training Script
File: backend/ml/train_tb_model.py

Run once to generate the model:
    cd backend
    python ml/train_tb_model.py

Produces: backend/ml/tb_risk_model.json (XGBoost) + ml/tb_scaler.pkl (StandardScaler)

Features (13 total — matches asha_agent.py symptom schema):
  cough_weeks, night_fever, weight_loss, hemoptysis, dyspnea,
  chest_pain, contact_tb, occupation_risk, hiv_positive,
  cough_phlegm, night_sweats, loss_appetite, swollen_lymph
"""

import os
import json
import pickle
import numpy as np
import pandas as pd
from pathlib import Path

# ── Try importing ML libs ─────────────────────────────────────────────────────
try:
    import xgboost as xgb
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import StandardScaler
    from sklearn.metrics import classification_report, roc_auc_score
    print("[ML] XGBoost and scikit-learn available")
except ImportError as e:
    print(f"[ML] Missing dependency: {e}")
    print("Run: pip install xgboost scikit-learn numpy pandas")
    exit(1)

FEATURE_COLS = [
    "cough_weeks",
    "night_fever",
    "weight_loss",
    "hemoptysis",
    "dyspnea",
    "chest_pain",
    "contact_tb",
    "occupation_risk",
    "hiv_positive",
    "cough_phlegm",
    "night_sweats",
    "loss_appetite",
    "swollen_lymph",
]

OUTPUT_DIR = Path(__file__).parent
MODEL_PATH = OUTPUT_DIR / "tb_risk_model.json"
SCALER_PATH = OUTPUT_DIR / "tb_scaler.pkl"
FEATURES_PATH = OUTPUT_DIR / "feature_cols.json"


def generate_synthetic_data(n: int = 1200, seed: int = 42) -> pd.DataFrame:
    """
    Generate synthetic TB patient data based on WHO/RNTCP clinical criteria.

    TB positive probability weights:
      - hemoptysis alone → very high risk
      - classic triad (cough ≥ 4w + fever + weight loss) → high risk
      - contact with TB → elevated risk
      - HIV positive → elevated risk
      - occupation risk + 2+ symptoms → elevated risk
    """
    rng = np.random.default_rng(seed)
    rows = []

    for _ in range(n):
        # Base symptom generation — realistic prevalence
        cough_weeks     = rng.choice([0, 1, 2, 4, 8, 12, 16], p=[0.25, 0.20, 0.18, 0.15, 0.10, 0.07, 0.05])
        night_fever     = int(rng.random() < 0.35)
        weight_loss     = int(rng.random() < 0.30)
        hemoptysis      = int(rng.random() < 0.12)
        dyspnea         = int(rng.random() < 0.25)
        chest_pain      = int(rng.random() < 0.22)
        contact_tb      = int(rng.random() < 0.18)
        occupation_risk = int(rng.random() < 0.20)
        hiv_positive    = int(rng.random() < 0.08)
        cough_phlegm    = int(rng.random() < 0.40)
        night_sweats    = int(rng.random() < 0.28)
        loss_appetite   = int(rng.random() < 0.32)
        swollen_lymph   = int(rng.random() < 0.15)

        # ── Compute TB probability using WHO criteria ─────────────────────────
        score = 0.0

        # Cough duration (most important single predictor)
        if cough_weeks >= 2:
            score += 0.25 + min(cough_weeks / 16.0, 1.0) * 0.20

        # Classic triad
        if night_fever and weight_loss and cough_weeks >= 4:
            score += 0.30

        # Hemoptysis — always elevates to high
        if hemoptysis:
            score += 0.45

        # Individual symptom contributions
        score += night_fever     * 0.12
        score += weight_loss     * 0.10
        score += dyspnea         * 0.08
        score += chest_pain      * 0.06
        score += night_sweats    * 0.08
        score += loss_appetite   * 0.07
        score += swollen_lymph   * 0.09
        score += cough_phlegm    * 0.05

        # Risk factor multipliers
        score += contact_tb      * 0.20
        score += hiv_positive    * 0.25
        score += occupation_risk * 0.08

        # Add realistic noise
        score += rng.normal(0, 0.05)
        score = max(0.0, min(1.0, score))

        # Label: TB positive if score > 0.40
        tb_positive = int(score > 0.40)

        rows.append({
            "cough_weeks": cough_weeks,
            "night_fever": night_fever,
            "weight_loss": weight_loss,
            "hemoptysis": hemoptysis,
            "dyspnea": dyspnea,
            "chest_pain": chest_pain,
            "contact_tb": contact_tb,
            "occupation_risk": occupation_risk,
            "hiv_positive": hiv_positive,
            "cough_phlegm": cough_phlegm,
            "night_sweats": night_sweats,
            "loss_appetite": loss_appetite,
            "swollen_lymph": swollen_lymph,
            "tb_positive": tb_positive,
            "_raw_score": score,
        })

    df = pd.DataFrame(rows)
    pos_rate = df["tb_positive"].mean()
    print(f"[DATA] Generated {n} samples — {pos_rate:.1%} TB positive")
    return df


def train_model(df: pd.DataFrame):
    X = df[FEATURE_COLS].values
    y = df["tb_positive"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    # Scale features (XGBoost doesn't strictly need this, but helps with feature importance)
    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s  = scaler.transform(X_test)

    model = xgb.XGBClassifier(
        n_estimators=200,
        max_depth=5,
        learning_rate=0.08,
        subsample=0.85,
        colsample_bytree=0.85,
        scale_pos_weight=(y == 0).sum() / (y == 1).sum(),  # handle class imbalance
        use_label_encoder=False,
        eval_metric="logloss",
        random_state=42,
    )

    model.fit(
        X_train_s, y_train,
        eval_set=[(X_test_s, y_test)],
        verbose=False,
    )

    # Evaluate
    y_pred_proba = model.predict_proba(X_test_s)[:, 1]
    y_pred       = (y_pred_proba > 0.40).astype(int)
    auc          = roc_auc_score(y_test, y_pred_proba)

    print(f"\n[EVAL] AUC-ROC: {auc:.4f}")
    print("[EVAL] Classification report:")
    print(classification_report(y_test, y_pred, target_names=["TB Negative", "TB Positive"]))

    # Feature importance
    importances = dict(zip(FEATURE_COLS, model.feature_importances_))
    sorted_imp = sorted(importances.items(), key=lambda x: x[1], reverse=True)
    print("\n[FEATURES] Top feature importances:")
    for feat, imp in sorted_imp[:5]:
        print(f"  {feat:<20} {imp:.4f}")

    return model, scaler


def save_artifacts(model, scaler):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Save XGBoost model as JSON (portable, version-independent)
    model.save_model(str(MODEL_PATH))
    print(f"\n[SAVE] XGBoost model → {MODEL_PATH}")

    # Save scaler as pickle
    with open(SCALER_PATH, "wb") as f:
        pickle.dump(scaler, f)
    print(f"[SAVE] Scaler → {SCALER_PATH}")

    # Save feature column order (critical for inference)
    with open(FEATURES_PATH, "w") as f:
        json.dump(FEATURE_COLS, f)
    print(f"[SAVE] Feature columns → {FEATURES_PATH}")


if __name__ == "__main__":
    print("=" * 60)
    print("VoiceCare PHC — TB Risk XGBoost Model Training")
    print("=" * 60)

    df = generate_synthetic_data(n=1200)
    model, scaler = train_model(df)
    save_artifacts(model, scaler)

    print("\n✅ Training complete. Model saved to backend/ml/")
    print("   The asha_agent.py will auto-load on next server start.\n")
