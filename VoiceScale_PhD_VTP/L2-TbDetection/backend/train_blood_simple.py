#!/usr/bin/env python3
"""
Simple training script for blood test model using XGBoost directly
"""

import os
import sys
import numpy as np
import pandas as pd
import joblib
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, accuracy_score
from xgboost import XGBClassifier

def engineer_features(
    hemoglobin: float,
    wbc_count: float,
    esr: float,
    crp: float,
) -> np.ndarray:
    """Returns a 1-D feature vector with raw values + abnormality flags."""
    HEALTHY_RANGES = {
        "hemoglobin":  (12.0, 17.5),   # g/dL
        "wbc_count":   (4.0,  11.0),   # × 10³/µL
        "esr":         (0.0,  20.0),   # mm/hr
        "crp":         (0.0,  10.0),   # mg/L
    }
    
    raw = np.array([hemoglobin, wbc_count, esr, crp], dtype=np.float32)
    
    flags = np.array([
        1.0 if not (HEALTHY_RANGES["hemoglobin"][0]  <= hemoglobin <= HEALTHY_RANGES["hemoglobin"][1])  else 0.0,
        1.0 if not (HEALTHY_RANGES["wbc_count"][0]   <= wbc_count  <= HEALTHY_RANGES["wbc_count"][1])   else 0.0,
        1.0 if not (HEALTHY_RANGES["esr"][0]         <= esr        <= HEALTHY_RANGES["esr"][1])         else 0.0,
        1.0 if not (HEALTHY_RANGES["crp"][0]         <= crp        <= HEALTHY_RANGES["crp"][1])         else 0.0,
    ], dtype=np.float32)
    
    return np.concatenate([raw, flags]).reshape(1, -1)

def generate_synthetic_data(n_samples: int = 1000, seed: int = 42) -> pd.DataFrame:
    """Generate synthetic blood test data"""
    rng = np.random.default_rng(seed)
    n_tb = n_samples // 2
    n_normal = n_samples - n_tb
    
    # Normal patients
    normal = pd.DataFrame({
        "hemoglobin": rng.normal(14.0, 1.5, n_normal).clip(10, 18),
        "wbc_count": rng.normal(7.0, 1.5, n_normal).clip(3, 15),
        "esr": rng.normal(10.0, 5.0, n_normal).clip(0, 20),
        "crp": rng.normal(3.0, 2.0, n_normal).clip(0, 10),
        "label": 0
    })
    
    # TB patients (abnormal values)
    tb = pd.DataFrame({
        "hemoglobin": rng.normal(11.0, 1.8, n_tb).clip(7, 15),
        "wbc_count": rng.normal(10.0, 2.5, n_tb).clip(5, 20),
        "esr": rng.normal(35.0, 15.0, n_tb).clip(15, 80),
        "crp": rng.normal(25.0, 10.0, n_tb).clip(5, 60),
        "label": 1
    })
    
    # Combine and shuffle
    df = pd.concat([normal, tb], ignore_index=True)
    df = df.sample(frac=1, random_state=seed).reset_index(drop=True)
    return df

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
    y = df["label"].values.astype(int)
    return X, y

class SimpleBloodModel:
    def __init__(self):
        self.scaler = StandardScaler()
        self.classifier = XGBClassifier(
            n_estimators=200,
            max_depth=4,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            eval_metric="logloss",
            random_state=42,
            n_jobs=-1,
            verbosity=0,
        )
        self.fitted = False
    
    def fit(self, X, y):
        X_scaled = self.scaler.fit_transform(X)
        self.classifier.fit(X_scaled, y)
        self.fitted = True
    
    def predict_proba(self, X):
        if not self.fitted:
            raise ValueError("Model not fitted")
        X_scaled = self.scaler.transform(X)
        return self.classifier.predict_proba(X_scaled)
    
    def predict(self, X):
        if not self.fitted:
            raise ValueError("Model not fitted")
        X_scaled = self.scaler.transform(X)
        return self.classifier.predict(X_scaled)

def main():
    print("Generating synthetic blood test data...")
    df = generate_synthetic_data(n_samples=1000, seed=42)
    print(f"Generated {len(df)} samples")
    
    print("Preparing features...")
    X, y = prepare_features(df)
    print(f"Feature shape: {X.shape}")
    
    # Split data
    from sklearn.model_selection import train_test_split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    print("Training XGBoost model...")
    model = SimpleBloodModel()
    model.fit(X_train, y_train)
    
    # Evaluate
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    print(f"Test accuracy: {accuracy:.3f}")
    
    # Save model
    os.makedirs("blood_test/weights", exist_ok=True)
    save_path = "blood_test/weights/xgb_tb.pkl"
    joblib.dump(model, save_path)
    print(f"Model saved to {save_path}")
    
    # Test with sample data
    print("\nTesting with sample blood test values:")
    sample_hb, sample_wbc, sample_esr, sample_crp = 12.5, 9.0, 25.0, 15.0
    sample_features = engineer_features(sample_hb, sample_wbc, sample_esr, sample_crp)
    prob = model.predict_proba(sample_features)[0, 1]
    print(f"Sample prediction (HB={sample_hb}, WBC={sample_wbc}, ESR={sample_esr}, CRP={sample_crp})")
    print(f"TB probability: {prob:.3f}")

if __name__ == "__main__":
    main()
