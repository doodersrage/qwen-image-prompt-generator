from __future__ import annotations

from .api_client import extract_prompt, post_json, resolve_api_base
from .constants import (
    DEFAULT_MODEL,
    DETAIL_LEVELS,
    IMAGE_FOCUS_OPTIONS,
    MODEL_IDS,
    PORTRAIT_STYLES,
    PROMPT_MODES,
)
from .image_utils import tensor_to_data_url


class PromptToolsBase:
    CATEGORY = "prompt tools"
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("prompt",)
    OUTPUT_NODE = False

    @classmethod
    def api_input(cls):
        return {
            "api_base_url": (
                "STRING",
                {
                    "default": resolve_api_base(""),
                    "tooltip": "Base URL for the Next.js prompt API. Override with COMFY_PROMPT_API_URL.",
                },
            ),
        }

    @classmethod
    def model_detail_inputs(cls):
        return {
            "model": (MODEL_IDS, {"default": DEFAULT_MODEL}),
            "detail": (DETAIL_LEVELS, {"default": "balanced"}),
        }


class PromptToolsGenerate(PromptToolsBase):
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "input": (
                    "STRING",
                    {
                        "multiline": True,
                        "default": "neon alley, rain, black cat",
                        "tooltip": "Topic, keywords, or scene idea.",
                    },
                ),
                **cls.model_detail_inputs(),
                "mode": (PROMPT_MODES, {"default": "positive"}),
                "distinct_people": ("BOOLEAN", {"default": True}),
                "variation_enabled": ("BOOLEAN", {"default": True}),
                "variation_strength": (
                    "INT",
                    {"default": 65, "min": 0, "max": 100, "step": 1},
                ),
            },
            "optional": cls.api_input(),
        }

    FUNCTION = "generate"

    def generate(
        self,
        input: str,
        model: str,
        detail: str,
        mode: str,
        distinct_people: bool,
        variation_enabled: bool,
        variation_strength: int,
        api_base_url: str = "",
    ):
        text = input.strip()
        if not text:
            raise RuntimeError("Input is required.")

        response = post_json(
            api_base_url,
            "/api/generate",
            {
                "input": text,
                "model": model,
                "detail": detail,
                "mode": mode,
                "distinctPeople": distinct_people,
                "variation": {
                    "enabled": variation_enabled,
                    "strength": variation_strength,
                },
            },
        )
        return (extract_prompt(response),)


class PromptToolsFormat(PromptToolsBase):
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "input": (
                    "STRING",
                    {
                        "multiline": True,
                        "default": "1girl, neon alley, rain, masterpiece",
                        "tooltip": "Existing prompt draft to adapt.",
                    },
                ),
                **cls.model_detail_inputs(),
                "mode": (PROMPT_MODES, {"default": "positive"}),
                "smart_format": ("BOOLEAN", {"default": True}),
            },
            "optional": cls.api_input(),
        }

    FUNCTION = "format"

    def format(
        self,
        input: str,
        model: str,
        detail: str,
        mode: str,
        smart_format: bool,
        api_base_url: str = "",
    ):
        text = input.strip()
        if not text:
            raise RuntimeError("Input is required.")

        response = post_json(
            api_base_url,
            "/api/format",
            {
                "input": text,
                "model": model,
                "detail": detail,
                "mode": mode,
                "smartFormat": smart_format,
            },
        )
        return (extract_prompt(response),)


class PromptToolsRandomScene(PromptToolsBase):
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                **cls.model_detail_inputs(),
                "genre": ("STRING", {"default": "", "multiline": False}),
                "include_people": ("BOOLEAN", {"default": True}),
                "wildness": ("INT", {"default": 65, "min": 0, "max": 100, "step": 1}),
            },
            "optional": cls.api_input(),
        }

    FUNCTION = "generate"

    def generate(
        self,
        model: str,
        detail: str,
        genre: str,
        include_people: bool,
        wildness: int,
        api_base_url: str = "",
    ):
        payload = {
            "model": model,
            "detail": detail,
            "includePeople": include_people,
            "wildness": wildness,
        }
        if genre.strip():
            payload["genre"] = genre.strip()

        response = post_json(api_base_url, "/api/random-scene", payload)
        return (extract_prompt(response),)


class PromptToolsCharacter(PromptToolsBase):
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                **cls.model_detail_inputs(),
                "hints": ("STRING", {"default": "", "multiline": True}),
                "portrait_style": (PORTRAIT_STYLES, {"default": "portrait"}),
                "variation_strength": (
                    "INT",
                    {"default": 50, "min": 0, "max": 100, "step": 1},
                ),
            },
            "optional": cls.api_input(),
        }

    FUNCTION = "generate"

    def generate(
        self,
        model: str,
        detail: str,
        hints: str,
        portrait_style: str,
        variation_strength: int,
        api_base_url: str = "",
    ):
        payload = {
            "model": model,
            "detail": detail,
            "portraitStyle": portrait_style,
            "variationStrength": variation_strength,
        }
        if hints.strip():
            payload["hints"] = hints.strip()

        response = post_json(api_base_url, "/api/character", payload)
        return (extract_prompt(response),)


class PromptToolsBackground(PromptToolsBase):
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                **cls.model_detail_inputs(),
                "setting_type": ("STRING", {"default": "", "multiline": False}),
                "time_of_day": ("STRING", {"default": "", "multiline": False}),
                "mood": ("STRING", {"default": "", "multiline": False}),
            },
            "optional": cls.api_input(),
        }

    FUNCTION = "generate"

    def generate(
        self,
        model: str,
        detail: str,
        setting_type: str,
        time_of_day: str,
        mood: str,
        api_base_url: str = "",
    ):
        payload = {
            "model": model,
            "detail": detail,
        }
        if setting_type.strip():
            payload["settingType"] = setting_type.strip()
        if time_of_day.strip():
            payload["timeOfDay"] = time_of_day.strip()
        if mood.strip():
            payload["mood"] = mood.strip()

        response = post_json(api_base_url, "/api/background", payload)
        return (extract_prompt(response),)


class PromptToolsImageToPrompt(PromptToolsBase):
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                **cls.model_detail_inputs(),
                "focus": (IMAGE_FOCUS_OPTIONS, {"default": "full"}),
                "extra_hints": ("STRING", {"default": "", "multiline": True}),
            },
            "optional": cls.api_input(),
        }

    FUNCTION = "generate"

    def generate(
        self,
        image,
        model: str,
        detail: str,
        focus: str,
        extra_hints: str,
        api_base_url: str = "",
    ):
        image_data_url, mime_type = tensor_to_data_url(image)
        payload = {
            "image": image_data_url,
            "mimeType": mime_type,
            "model": model,
            "detail": detail,
            "focus": focus,
        }
        if extra_hints.strip():
            payload["extraHints"] = extra_hints.strip()

        response = post_json(api_base_url, "/api/image-prompt", payload)
        return (extract_prompt(response),)


NODE_CLASS_MAPPINGS = {
    "PromptToolsGenerate": PromptToolsGenerate,
    "PromptToolsFormat": PromptToolsFormat,
    "PromptToolsRandomScene": PromptToolsRandomScene,
    "PromptToolsCharacter": PromptToolsCharacter,
    "PromptToolsBackground": PromptToolsBackground,
    "PromptToolsImageToPrompt": PromptToolsImageToPrompt,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "PromptToolsGenerate": "Prompt Tools · Generate",
    "PromptToolsFormat": "Prompt Tools · Format",
    "PromptToolsRandomScene": "Prompt Tools · Random Scene",
    "PromptToolsCharacter": "Prompt Tools · Character",
    "PromptToolsBackground": "Prompt Tools · Background",
    "PromptToolsImageToPrompt": "Prompt Tools · Image → Prompt",
}
