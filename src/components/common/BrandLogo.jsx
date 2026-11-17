
import "./BrandLogo.css";

function BrandLogo({ compact = false }) {
  return (
    <div className={`brand-logo ${compact ? "brand-logo--compact" : ""}`}>
      <img
        src="/gdg-kau-logo.svg"
        alt="GDG logo"
        className="brand-logo__image"
      />

      {!compact && (
        <div className="brand-logo__text">
          <span>Google Developer Group</span>
          <span>King Abdulaziz University</span>
        </div>
      )}
    </div>
  );
}

export default BrandLogo;
