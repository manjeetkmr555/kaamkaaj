import Image from "next/image";

const LOGO_SRC = "/logo/kaamkaj_logo_1.png";
const LOGO_SIZE = 52;

export function BrandLockup() {
  return (
    <div className="brand-lockup">
      <Image
        src={LOGO_SRC}
        alt=""
        width={LOGO_SIZE}
        height={LOGO_SIZE}
        className="brand-lockup__logo"
        unoptimized
        priority
      />
      <p className="auth-brand">KaamKaaj</p>
      <Image
        src={LOGO_SRC}
        alt=""
        width={LOGO_SIZE}
        height={LOGO_SIZE}
        className="brand-lockup__logo"
        unoptimized
        priority
      />
    </div>
  );
}
