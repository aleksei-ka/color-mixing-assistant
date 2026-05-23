from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="COLOR_MATCHER_")

    frame_width: int = 1280
    frame_height: int = 720
    roi_size: int = 48


settings = Settings()
