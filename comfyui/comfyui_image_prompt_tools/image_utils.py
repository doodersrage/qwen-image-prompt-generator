from __future__ import annotations

import base64
import io

import numpy as np
from PIL import Image


def tensor_to_data_url(image_tensor) -> tuple[str, str]:
    if image_tensor is None:
        raise RuntimeError("Image input is required.")

    tensor = image_tensor
    if len(tensor.shape) == 4:
        tensor = tensor[0]

    array = np.clip(255.0 * tensor.cpu().numpy(), 0, 255).astype(np.uint8)
    image = Image.fromarray(array)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}", "image/png"
