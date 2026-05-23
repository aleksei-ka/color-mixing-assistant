from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="COLOR_MATCHER_")

    frame_width: int = 1280
    frame_height: int = 720
    roi_size: int = 48
    host: str = "127.0.0.1"
    port: int = 8000
    # Comma-separated origins; same-origin prod (static + API) often needs no extra origins.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    static_dir: str = ""

    @field_validator("static_dir", mode="before")
    @classmethod
    def empty_static_is_none(cls, v: object) -> str:
        if v is None:
            return ""
        return str(v).strip()

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
