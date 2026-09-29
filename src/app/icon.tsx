import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <svg height={32} viewBox="0 0 32 32" width={32} xmlns="http://www.w3.org/2000/svg">
        <rect fill="#16372c" height={32} rx={6} width={32} />
        <g fill="#ffffff" stroke="none" transform="translate(4,3)">
          <path d="M12 1 L17.5 10 L14.5 10 L19.5 18 L4.5 18 L9.5 10 L6.5 10 Z" />
          <rect height={4.5} rx={1} width={3.4} x={10.3} y={18} />
        </g>
      </svg>
    ),
    size,
  );
}
