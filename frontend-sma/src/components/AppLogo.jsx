// frontend-sma/src/components/AppLogo.jsx
export default function ShieldLogo({ className = "w-8 h-8" }) {
  return (
    <img
      src="/home-assets/logo.png"
      alt="Warranty Platform Logo"
      className={`${className} object-contain drop-shadow-md`}
      draggable="false"
    />
  );
}