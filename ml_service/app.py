import os
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

import io
import logging
import numpy as np
from PIL import Image
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import tensorflow as tf

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("freshrescue-ml")

app = FastAPI(title="FreshRescue CNN Freshness Classifier", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Standard Kaggle 6-class Fruit Freshness Dataset classes (alphabetical order)
CLASS_NAMES = [
    "freshapples",   # 0
    "freshbanana",   # 1
    "freshoranges",  # 2
    "rottenapples",  # 3
    "rottenbanana",  # 4
    "rottenoranges", # 5
]

MODEL_PATH = os.path.join(os.path.dirname(__file__), "fruit_freshness_model.h5")
logger.info(f"Loading Keras CNN model from: {MODEL_PATH}")
model = tf.keras.models.load_model(MODEL_PATH)
logger.info(f"Model successfully loaded. Input shape: {model.input_shape}, Output shape: {model.output_shape}")

@app.get("/")
@app.get("/health")
def health_check():
    return {
        "status": "online",
        "service": "FreshRescue CNN Freshness Service",
        "model": "MobileNetV2 Fruit Freshness",
        "classes": CLASS_NAMES,
        "input_shape": list(model.input_shape)
    }

@app.post("/predict")
async def predict_freshness(image: UploadFile = File(...)):
    try:
        # 1. Read uploaded image bytes
        contents = await image.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Empty image uploaded")

        pil_img = Image.open(io.BytesIO(contents)).convert("RGB")
        
        # 2. Resize to model's expected 224x224
        target_size = (224, 224)
        resized_img = pil_img.resize(target_size)
        
        # 3. Convert to float numpy array and scale to [0, 1]
        img_array = np.array(resized_img, dtype=np.float32) / 255.0
        input_tensor = np.expand_dims(img_array, axis=0) # Shape: (1, 224, 224, 3)

        # 4. Run model inference
        predictions = model.predict(input_tensor, verbose=0)[0]
        
        # Class probabilities
        # 0: freshapples, 1: freshbanana, 2: freshoranges
        # 3: rottenapples, 4: rottenbanana, 5: rottenoranges
        fresh_prob = float(predictions[0] + predictions[1] + predictions[2])
        rotten_prob = float(predictions[3] + predictions[4] + predictions[5])
        
        # Normalize between fresh vs rotten
        total = fresh_prob + rotten_prob
        if total > 0:
            freshness_score = round(fresh_prob / total, 2)
        else:
            freshness_score = 0.50

        top_idx = int(np.argmax(predictions))
        top_class = CLASS_NAMES[top_idx] if top_idx < len(CLASS_NAMES) else "unknown"

        # 5. Estimate shelf-life days based on freshness score
        if freshness_score >= 0.70:
            days_to_expiry = 7
        elif freshness_score >= 0.50:
            days_to_expiry = 4
        elif freshness_score >= 0.30:
            days_to_expiry = 2
        elif freshness_score >= 0.10:
            days_to_expiry = 1
        else:
            days_to_expiry = 0

        logger.info(
            f"Prediction: top_class={top_class} ({predictions[top_idx]:.2f}), "
            f"freshnessScore={freshness_score}, days={days_to_expiry}"
        )

        # Contract matching Spring Boot MlPredictionResponse DTO
        return {
            "freshnessScore": freshness_score,
            "predictedDaysToExpiry": days_to_expiry,
            "ocrExtractedDate": None
        }

    except Exception as e:
        logger.error(f"Prediction failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)
