import os
import sys

# TensorFlow / Keras configuration — must be set before importing TensorFlow
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
os.environ.setdefault("KERAS_HOME", os.path.join(os.path.dirname(__file__), ".keras"))

import numpy as np
from PIL import Image
import tensorflow as tf

CLASS_NAMES = ["fresh", "rotten", "semifresh"]

ANCHOR_SCORES = {
    "fresh": 1.00,
    "semifresh": 0.78,
    "rotten": 0.30,
}

MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    "fruit_freshness_model.keras"
)


def evaluate_image(model, image_path: str):
    if not os.path.exists(image_path):
        print(f"Error: File not found: {image_path}")
        return

    try:
        pil_img = Image.open(image_path).convert("RGB")
        target_size = (224, 224)
        resized_img = pil_img.resize(target_size, Image.Resampling.LANCZOS)

        # Raw pixel values 0-255 as float32 (the model includes its own Rescaling layer)
        img_array = np.asarray(resized_img, dtype=np.float32)
        input_tensor = np.expand_dims(img_array, axis=0)

        predictions = model.predict(input_tensor, verbose=0)[0]

        prediction_sum = float(np.sum(predictions))
        if not np.isclose(prediction_sum, 1.0, atol=0.01):
            predictions = tf.nn.softmax(predictions).numpy()

        top_idx = int(np.argmax(predictions))
        top_class = CLASS_NAMES[top_idx]
        confidence = float(predictions[top_idx])

        # Freshness score using anchor scores
        freshness_score = round(
            float(sum(predictions[i] * ANCHOR_SCORES[cls] for i, cls in enumerate(CLASS_NAMES))),
            2
        )

        needs_manual_review = bool(confidence < 0.60)

        # Predicted days to expiry placeholder
        if freshness_score >= 0.90:
            days_to_expiry = 7
        elif freshness_score >= 0.85:
            days_to_expiry = 5
        elif freshness_score >= 0.70:
            days_to_expiry = 3
        elif freshness_score >= 0.65:
            days_to_expiry = 1
        else:
            days_to_expiry = 0

        print(f"\n========================================================")
        print(f"Image:                 {image_path}")
        print(f"Predicted Class:       {top_class}")
        print(f"Confidence:            {confidence:.4f} ({confidence * 100:.2f}%)")
        print(f"Needs Manual Review:   {needs_manual_review}")
        print(f"Freshness Score:       {freshness_score:.2f}")
        print(f"Predicted Days Left:   {days_to_expiry}")
        print("Class Probabilities:")
        for cls, prob in zip(CLASS_NAMES, predictions):
            print(f"  - {cls:<12}: {prob:.4f} ({prob * 100:.2f}%)")
        print(f"========================================================")

    except Exception as e:
        print(f"Error processing {image_path}: {e}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python test_model.py <image_path_1> [image_path_2 ...]")
        sys.exit(1)

    print(f"Loading model from: {MODEL_PATH}")
    model = tf.keras.models.load_model(MODEL_PATH, compile=False)
    print("Model loaded successfully.\n")

    for path in sys.argv[1:]:
        evaluate_image(model, path)


if __name__ == "__main__":
    main()

