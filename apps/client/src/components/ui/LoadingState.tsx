interface LoadingStateProps {
  label?: string;
  fullPage?: boolean;
}

export default function LoadingState({ label = "Loading...", fullPage = false }: LoadingStateProps) {
  return (
    <div className={fullPage ? "veyra-loading-state full-page" : "veyra-loading-state"}>
      <span className="spinner big" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}
