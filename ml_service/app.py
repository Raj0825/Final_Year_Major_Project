import os

# TensorFlow configuration — must be set before importing TensorFlow
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

import io
import logging

import numpy as np
from PIL import Image

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import tensorflow as tf


# ============================================================
# LOGGING
# ============================================================

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("freshrescue-ml")


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(
    title="FreshRescue CNN Freshness Classifier",
    version="1.1.0"
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# MODEL CONFIGURATION
# ============================================================

CLASS_NAMES = [
    "freshapples",    # 0
    "freshbanana",    # 1
    "freshoranges",   # 2
    "rottenapples",   # 3
    "rottenbanana",   # 4
    "rottenoranges"   # 5
]

EXPECTED_CLASSES = len(CLASS_NAMES)

MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    "fruit_freshness_model.h5"
)


# ============================================================
# LOAD MODEL
# ============================================================

logger.info(f"Loading Keras CNN model from: {MODEL_PATH}")

try:
    model = tf.keras.models.load_model(
        MODEL_PATH,
        compile=False
    )

    logger.info(
        f"Model successfully loaded. "
        f"Input shape: {model.input_shape}, "
        f"Output shape: {model.output_shape}"
    )

except Exception as e:
    logger.error(f"Failed to load model: {str(e)}")
    raise


# ============================================================
# VALIDATE MODEL
# ============================================================

if model.output_shape[-1] != EXPECTED_CLASSES:
    raise RuntimeError(
        f"Model output has {model.output_shape[-1]} classes, "
        f"but CLASS_NAMES contains {EXPECTED_CLASSES} classes."
    )


# ============================================================
# ROOT / HEALTH CHECK
# ============================================================

@app.get("/")
@app.get("/health")
def health_check():
    return {
        "status": "online",
        "service": "FreshRescue CNN Freshness Service",
        "model": "MobileNetV2 Fruit Freshness",
        "classes": CLASS_NAMES,
        "input_shape": list(model.input_shape),
        "output_classes": int(model.output_shape[-1])
    }


# ============================================================
# PREDICTION ENDPOINT
# ============================================================

@app.post("/predict")
async def predict_freshness(image: UploadFile = File(...)):

    try:

        # ----------------------------------------------------
        # 1. Validate uploaded file
        # ----------------------------------------------------

        if not image.content_type:
            raise HTTPException(
                status_code=400,
                detail="Invalid image file"
            )

        if not image.content_type.startswith("image/"):
            raise HTTPException(
                status_code=400,
                detail="Uploaded file must be an image"
            )


        # ----------------------------------------------------
        # 2. Read image
        # ----------------------------------------------------

        contents = await image.read()

        if not contents:
            raise HTTPException(
                status_code=400,
                detail="Empty image uploaded"
            )


        # ----------------------------------------------------
        # 3. Open image
        # ----------------------------------------------------

        try:
            pil_img = Image.open(
                io.BytesIO(contents)
            ).convert("RGB")

        except Exception:
            raise HTTPException(
                status_code=400,
                detail="Unable to read uploaded image"
            )


        # ----------------------------------------------------
        # 4. Resize image
        # ----------------------------------------------------

        target_size = (224, 224)

        resized_img = pil_img.resize(
            target_size,
            Image.Resampling.LANCZOS
        )


        # ----------------------------------------------------
        # 5. Convert image to NumPy array
        #
        # IMPORTANT:
        # This assumes your model was trained using:
        #
        #     rescale=1./255
        #
        # or equivalent [0,1] preprocessing.
        # ----------------------------------------------------

        img_array = np.asarray(
            resized_img,
            dtype=np.float32
        )

        img_array = img_array / 255.0


        # ----------------------------------------------------
        # 6. Add batch dimension
        # ----------------------------------------------------

        input_tensor = np.expand_dims(
            img_array,
            axis=0
        )


        # ----------------------------------------------------
        # 7. Run model prediction
        # ----------------------------------------------------

        predictions = model.predict(
            input_tensor,
            verbose=0
        )[0]


        # ----------------------------------------------------
        # 8. Validate prediction output
        # ----------------------------------------------------

        if len(predictions) != EXPECTED_CLASSES:
            raise RuntimeError(
                f"Expected {EXPECTED_CLASSES} predictions, "
                f"but model returned {len(predictions)}"
            )


        # ----------------------------------------------------
        # 9. Normalize predictions if necessary
        #
        # Normally softmax output should already sum to 1.
        # This makes the API safer if the final layer does not.
        # ----------------------------------------------------

        prediction_sum = float(np.sum(predictions))

        if prediction_sum <= 0:
            raise RuntimeError(
                "Model returned invalid prediction probabilities"
            )

        if not np.isclose(prediction_sum, 1.0, atol=0.01):
            predictions = tf.nn.softmax(
                predictions
            ).numpy()


        # ----------------------------------------------------
        # 10. Get top prediction
        # ----------------------------------------------------

        top_idx = int(
            np.argmax(predictions)
        )

        top_class = CLASS_NAMES[top_idx]

        confidence = float(
            predictions[top_idx]
        )


        # ----------------------------------------------------
        # 11. Calculate fresh vs rotten probability
        # ----------------------------------------------------

        fresh_prob = float(
            predictions[0]
            + predictions[1]
            + predictions[2]
        )

        rotten_prob = float(
            predictions[3]
            + predictions[4]
            + predictions[5]
        )


        # ----------------------------------------------------
        # 12. Calculate freshness score
        #
        # 1.00 = completely fresh according to model
        # 0.00 = completely rotten according to model
        # ----------------------------------------------------

        total = fresh_prob + rotten_prob

        if total > 0:

            freshness_score = (
                    fresh_prob / total
            )

        else:

            freshness_score = 0.50


        freshness_score = round(
            float(freshness_score),
            2
        )


        # ----------------------------------------------------
        # 13. Determine confidence level
        # ----------------------------------------------------

        if confidence >= 0.80:

            confidence_level = "high"

        elif confidence >= 0.60:

            confidence_level = "medium"

        else:

            confidence_level = "low"


        # ----------------------------------------------------
        # 14. Estimate shelf life
        #
        # IMPORTANT:
        # This is a BUSINESS RULE based on freshness score.
        # The CNN itself does NOT directly predict days.
        # ----------------------------------------------------

        if freshness_score >= 0.80:

            days_to_expiry = 7

        elif freshness_score >= 0.60:

            days_to_expiry = 5

        elif freshness_score >= 0.40:

            days_to_expiry = 3

        elif freshness_score >= 0.20:

            days_to_expiry = 1

        else:

            days_to_expiry = 0


        # ----------------------------------------------------
        # 15. Create class probability dictionary
        # ----------------------------------------------------

        class_probabilities = {}

        for i, class_name in enumerate(CLASS_NAMES):

            class_probabilities[class_name] = round(
                float(predictions[i]),
                4
            )


        # ----------------------------------------------------
        # 16. Logging
        # ----------------------------------------------------

        logger.info(
            f"Prediction: "
            f"class={top_class}, "
            f"confidence={confidence:.2f}, "
            f"freshnessScore={freshness_score:.2f}, "
            f"freshProbability={fresh_prob:.2f}, "
            f"rottenProbability={rotten_prob:.2f}, "
            f"days={days_to_expiry}, "
            f"confidenceLevel={confidence_level}"
        )


        # ----------------------------------------------------
        # 17. Return response
        # ----------------------------------------------------

        return {

            # Existing Spring Boot fields
            "freshnessScore": freshness_score,

            "predictedDaysToExpiry": days_to_expiry,

            "ocrExtractedDate": None,


            # Additional ML information
            "predictedClass": top_class,

            "confidence": round(
                confidence,
                2
            ),

            "confidenceLevel": confidence_level,

            "freshProbability": round(
                fresh_prob,
                2
            ),

            "rottenProbability": round(
                rotten_prob,
                2
            ),

            "classProbabilities": class_probabilities
        }


    # ========================================================
    # HTTP EXCEPTION
    # ========================================================

    except HTTPException:
        raise


    # ========================================================
    # OTHER ERRORS
    # ========================================================

    except Exception as e:

        logger.error(
            f"Prediction failed: {str(e)}",
            exc_info=True
        )

        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(e)}"
        )


# ============================================================
# RUN SERVER
# ============================================================

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        reload=False
    )