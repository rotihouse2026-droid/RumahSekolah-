import React from 'react';
import { School } from 'lucide-react';
import { getGoogleDriveDirectLink } from '../utils/googleDrive';

interface LogoProps {
  logoUrl?: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({
  logoUrl,
  label = 'RumahSekolah',
  size = 'md',
  showText = true,
  className = '',
}) => {
  // Determine dimensions based on size
  const dimensions = {
    sm: { container: 'h-8 w-8', icon: 16, text: 'text-sm' },
    md: { container: 'h-10 w-10', icon: 20, text: 'text-base font-semibold' },
    lg: { container: 'h-16 w-16', icon: 32, text: 'text-xl font-bold' },
    xl: { container: 'h-24 w-24', icon: 48, text: 'text-3xl font-extrabold' },
  }[size] || { container: 'h-10 w-10', icon: 20, text: 'text-base font-semibold' };

  const directLogoUrl = logoUrl ? getGoogleDriveDirectLink(logoUrl) : '';

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div
        className={`${dimensions.container} rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200/50 overflow-hidden shrink-0`}
      >
        {directLogoUrl ? (
          <img
            src={directLogoUrl}
            alt={label}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            onError={(e) => {
              // Fallback to text initials if image fails
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <School size={dimensions.icon} className="stroke-[2]" />
        )}
      </div>

      {showText && (
        <span className={`font-sans tracking-tight text-gray-900 ${dimensions.text}`}>
          {label}
        </span>
      )}
    </div>
  );
};

export default Logo;
