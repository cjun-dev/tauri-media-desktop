type EmptyStateProps = {
  message: string;
  icon?: string;
  showButton: boolean;
  onSelectFiles: () => void;
};

export function EmptyState({
  message,
  icon = "♫",
  showButton,
  onSelectFiles,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <p className="empty-message">{message}</p>
      {showButton && (
        <button type="button" className="primary-button" onClick={onSelectFiles}>
          选择本地文件
        </button>
      )}
    </div>
  );
}
