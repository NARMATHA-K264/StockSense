export function ErrorMessage({ message }) { return message ? <div className="feedback error">{message}</div> : null; }
export function SuccessMessage({ message }) { return message ? <div className="feedback success">{message}</div> : null; }
export function EmptyState({ title, action, text }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {text ? <p className="empty-text">{text}</p> : null}
      {action}
    </div>
  );
}
