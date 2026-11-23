"""
blood_test/model.py
XGBoost-based binary classifier for TB prediction from blood markers.
"""

import os
import numpy as np
import joblib

try:
    import sklearn.base
    if hasattr(sklearn.base, "ClassifierMixin") and hasattr(sklearn.base.ClassifierMixin, "__sklearn_tags__"):
        _orig_clf_tags = sklearn.base.ClassifierMixin.__sklearn_tags__
        def _safe_sklearn_tags(self):
            try:
                return _orig_clf_tags(self)
            except AttributeError:
                tags = sklearn.base.BaseEstimator.__sklearn_tags__(self)
                tags.estimator_type = "classifier"
                if hasattr(sklearn.base, "ClassifierTags"):
                    tags.classifier_tags = sklearn.base.ClassifierTags()
                tags.target_tags.required = True
                return tags
        sklearn.base.ClassifierMixin.__sklearn_tags__ = _safe_sklearn_tags
except Exception:
    pass

from xgboost import XGBClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline


FEATURE_NAMES = ["hemoglobin", "wbc_count", "esr", "crp"]

# ── Reference ranges used for feature engineering ────────────────────────────
# Flags are 1 if value is outside healthy range, aiding the model.

HEALTHY_RANGES = {
    "hemoglobin":  (12.0, 17.5),   # g/dL
    "wbc_count":   (4.0,  11.0),   # × 10³/µL
    "esr":         (0.0,  20.0),   # mm/hr
    "crp":         (0.0,  10.0),   # mg/L
}


def engineer_features(
    hemoglobin: float,
    wbc_count: float,
    esr: float,
    crp: float,
) -> np.ndarray:
    """
    Returns a 1-D feature vector with raw values + abnormality flags.
    Shape: (8,)
    """
    raw = np.array([hemoglobin, wbc_count, esr, crp], dtype=np.float32)

    flags = np.array([
        1.0 if not (HEALTHY_RANGES["hemoglobin"][0]  <= hemoglobin <= HEALTHY_RANGES["hemoglobin"][1])  else 0.0,
        1.0 if not (HEALTHY_RANGES["wbc_count"][0]   <= wbc_count  <= HEALTHY_RANGES["wbc_count"][1])   else 0.0,
        1.0 if not (HEALTHY_RANGES["esr"][0]         <= esr        <= HEALTHY_RANGES["esr"][1])         else 0.0,
        1.0 if not (HEALTHY_RANGES["crp"][0]         <= crp        <= HEALTHY_RANGES["crp"][1])         else 0.0,
    ], dtype=np.float32)

    return np.concatenate([raw, flags]).reshape(1, -1)


def build_pipeline() -> Pipeline:
    """Returns an untrained sklearn Pipeline (scaler + XGBoost)."""
    xgb = XGBClassifier(
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
    )
    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("classifier", xgb),
    ])
    return pipeline


def save_pipeline(pipeline: Pipeline, path: str) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    joblib.dump(pipeline, path)
    print(f"[blood_test] Pipeline saved → {path}")


def load_pipeline(path: str) -> Pipeline:
    return joblib.load(path)
