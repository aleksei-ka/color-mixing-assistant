from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="COLOR_MATCHER_")

    camera_target_index: int = 0
    camera_palette_index: int = 1
    frame_width: int = 1280
    frame_height: int = 720
    roi_size: int = 48
    # Temporal smoothing (0 = off, closer to 1 = smoother)
    color_ema_alpha: float = 0.25
    # Use synthetic frames when a camera cannot be opened
    mock_on_failure: bool = True
    # Windows: CAP_DSHOW often works better for USB webcams
    use_dshow: bool = True
    # How many device indices to probe (0 .. max-1)
    camera_probe_max: int = 10


settings = Settings()
