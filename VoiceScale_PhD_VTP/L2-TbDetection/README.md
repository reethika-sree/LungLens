# TB Detect — AI-Powered Tuberculosis Detection System

A production-grade, modular TB detection system combining deep learning (DenseNet121),
machine learning (XGBoost), rule-based lab logic, and a weighted fusion model.

---

## 📁 Project Structure

```
tb-detection/
├── backend/
│   ├── app.py                   ← FastAPI main entry
│   ├── requirements.txt
│   ├── chest_xray/
│   │   ├── __init__.py
│   │   ├── model.py             ← DenseNet121 definition + freeze helpers
│   │   ├── train.py             ← Two-phase fine-tuning pipeline
│   │   └── inference.py         ← Image → TB probability
│   ├── blood_test/
│   │   ├── __init__.py
│   │   ├── model.py             ← XGBoost pipeline + feature engineering
│   │   ├── train.py             ← Training with CV evaluation
│   │   └── inference.py         ← Blood values → TB probability
│   ├── lab_test/
│   │   ├── __init__.py
│   │   └── logic.py             ← Rule-based GeneXpert interpreter
│   └── fusion/
│       ├── __init__.py
│       └── combine.py           ← Weighted fusion of all modules
│
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── components/
        │   ├── Header.jsx / .module.css
        │   ├── Sidebar.jsx / .module.css
        │   └── ResultCard.jsx / .module.css
        ├── pages/
        │   ├── XrayPage.jsx / .module.css
        │   ├── BloodTestPage.jsx / .module.css
        │   ├── LabTestPage.jsx / .module.css
        │   └── FinalResultPage.jsx / .module.css
        └── styles/
            ├── global.css
            └── App.module.css
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- (Optional) CUDA GPU for faster X-ray inference

---

### Step 1 — Clone / Download

```bash
cd tb-detection
```

---

### Step 2 — Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

---

### Step 3 — Train Models (Optional — skip for demo mode)

#### Blood Test (XGBoost)

```bash
cd backend

# With your own CSV (columns: hemoglobin, wbc_count, esr, crp, label)
python blood_test/train.py --data_csv /path/to/data.csv --save_path blood_test/weights/xgb_tb.pkl

# OR without data (generates synthetic dataset automatically)
python blood_test/train.py --save_path blood_test/weights/xgb_tb.pkl
```

#### Chest X-ray (DenseNet121)

```bash
# Requires dataset in ImageFolder format:
# data/train/TB/, data/train/Normal/
# data/val/TB/,   data/val/Normal/   (optional — auto-splits if absent)

python chest_xray/train.py \
  --data_dir /path/to/xray_dataset \
  --save_path chest_xray/weights/densenet121_tb.pth \
  --epochs_p1 5 \
  --epochs_p2 5

# Recommended public datasets:
#   - NIH ChestX-ray14  (kaggle.com/datasets/nih-chest-xrays/data)
#   - TBX11K            (kaggle.com/datasets/usharengaraju/tbx11k-updated)
#   - Montgomery/Shenzhen TB sets
```

> **Demo mode**: If no trained weights are found, the system runs in demo mode
> (X-ray uses pretrained ImageNet DenseNet121, blood uses a tiny synthetic-trained model).

---

### Step 4 — Start Backend API

```bash
cd backend
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

API docs available at: http://localhost:8000/docs

---

### Step 5 — Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend available at: http://localhost:5173

---

## 🔌 API Reference

| Method | Endpoint         | Description                                  |
|--------|-----------------|----------------------------------------------|
| GET    | /health          | Health check                                 |
| POST   | /predict/xray    | Chest X-ray analysis (multipart image)       |
| POST   | /predict/blood   | Blood test analysis (JSON body)              |
| POST   | /predict/lab     | Lab/GeneXpert interpretation (JSON body)     |
| POST   | /predict/final   | Fused final prediction (JSON body)           |

### /predict/blood — Request Body
```json
{
  "hemoglobin": 9.8,
  "wbc_count": 13.5,
  "esr": 68,
  "crp": 52
}
```

### /predict/lab — Request Body
```json
{
  "genexpert_result": "positive",
  "rifampicin_resistance": "yes"
}
```

### /predict/final — Request Body
```json
{
  "xray_prob": 78.5,
  "blood_prob": 82.1,
  "lab_result": true
}
```

---

## 🧠 Model Details

### Chest X-ray — DenseNet121
- **Architecture**: DenseNet121 with custom 2-layer classifier head
- **Input**: 224×224 RGB (grayscale converted to 3-channel)
- **Loss**: BCEWithLogitsLoss
- **Phase 1**: Frozen backbone, classifier only, LR=1e-3
- **Phase 2**: Last DenseBlock + classifier, LR=1e-5
- **Augmentation**: Random crop, horizontal flip, rotation ±10°, color jitter

### Blood Test — XGBoost
- **Features**: 8 (4 raw values + 4 abnormality flags)
- **Pipeline**: StandardScaler → XGBClassifier
- **Validation**: 5-fold stratified CV + held-out test set

### Lab Test — Rule-Based
- GeneXpert Positive → TB = True (confidence 99%)
- GeneXpert Negative → TB = False (confidence 95%)
- Rifampicin resistance → MDR-TB alert

### Fusion — Weighted Average
| Source   | Weight |
|----------|--------|
| Lab      | 50%    |
| X-ray    | 30%    |
| Blood    | 20%    |

Weights renormalize automatically for missing tests.
GeneXpert positive = hard override to ≥95% probability.

---

## 🩺 Clinical Notes

- AI output is **decision support only** — not a diagnostic tool
- GeneXpert positive result always overrides to TB-positive regardless of other tests
- Medication plans must be approved by a licensed physician
- System uses NTEP/WHO terminology for Indian clinical context
- All AI-generated recommendations should be verified clinically

---

## 📦 Production Deployment

### Docker (Backend)
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY . .
RUN pip install --no-cache-dir -r requirements.txt
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Environment Variables
```
XRAY_WEIGHTS=/path/to/densenet121_tb.pth
BLOOD_WEIGHTS=/path/to/xgb_tb.pkl
```

---

## 📜 License
For research and clinical decision-support use only.
Not approved as a standalone medical device.
