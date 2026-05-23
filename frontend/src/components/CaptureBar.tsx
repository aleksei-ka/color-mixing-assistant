type Props = {
  onRefreshCameras: () => void;
  refreshingCameras: boolean;
};

export function CaptureBar({ onRefreshCameras, refreshingCameras }: Props) {
  return (
    <section className="capture-bar">
      <div className="capture-bar-actions">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={refreshingCameras}
          onClick={onRefreshCameras}
        >
          {refreshingCameras ? "Поиск…" : "Обновить список камер"}
        </button>
      </div>
      <p className="muted small capture-bar-hint">
        У каждой камеры своя кнопка «Захватить» — сравнение и смешивание
        используют захваченный цвет, если он есть; иначе — live с видео.
      </p>
    </section>
  );
}
