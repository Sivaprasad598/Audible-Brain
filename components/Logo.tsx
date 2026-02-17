
import React from 'react';

interface Props {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const Logo: React.FC<Props> = ({ className = '', size = 'md' }) => {
  const sizes = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-24 w-24',
    xl: 'h-40 w-40'
  };

  return (
    <div className={`${sizes[size]} ${className} relative flex items-center justify-center`}>
      <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]">
        <defs>
          <linearGradient id="brainGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        {/* Brain Silhouette */}
        <path 
          d="M100,60 C70,60 50,75 45,100 C40,125 60,150 90,155 C95,156 100,150 100,140 L100,60 Z" 
          fill="url(#brainGradient)" 
        />
        <path 
          d="M100,60 C130,60 150,75 155,100 C160,125 140,150 110,155 C105,156 100,150 100,140 L100,60 Z" 
          fill="url(#brainGradient)" 
          opacity="0.9"
        />

        {/* Headset Frame */}
        <path 
          d="M40,110 Q40,40 100,40 Q160,40 160,110" 
          fill="none" 
          stroke="#ffffff" 
          strokeWidth="10" 
          strokeLinecap="round" 
        />
        
        {/* Headphones (Earcups) */}
        <rect x="25" y="95" width="22" height="45" rx="8" fill="#1e293b" stroke="#ffffff" strokeWidth="2" />
        <rect x="153" y="95" width="22" height="45" rx="8" fill="#1e293b" stroke="#ffffff" strokeWidth="2" />
        
        {/* Connection Detail */}
        <path d="M70,105 L130,105" stroke="white" strokeWidth="2" opacity="0.3" strokeDasharray="4 4" />
      </svg>
    </div>
  );
};

export default Logo;
