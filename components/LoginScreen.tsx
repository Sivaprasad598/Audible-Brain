
import React from 'react';
import Logo from './Logo';

interface Props {
  onLogin: (userData: { name: string; email: string; photo: string | null; isGuest?: boolean }) => void;
}

const LoginScreen: React.FC<Props> = ({ onLogin }) => {
  const handleGuestLogin = () => {
    onLogin({
      name: 'Guest Explorer',
      email: 'guest@audilebrain.ai',
      photo: null,
      isGuest: true
    });
  };

  const handleGoogleLogin = () => {
    // Simulated Google Login
    onLogin({
      name: 'Neural User',
      email: 'user@gmail.com',
      photo: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
    });
  };

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-80 h-80 bg-indigo-600/20 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-80 h-80 bg-rose-600/20 rounded-full blur-[120px] animate-pulse"></div>

      <div className="w-full max-w-md space-y-12 text-center animate-in fade-in zoom-in-95 duration-1000">
        <div className="flex flex-col items-center gap-6">
          <Logo size="xl" />
          <div className="space-y-2">
            <h1 className="text-5xl font-black text-white tracking-tighter">Audible Brain</h1>
            <p className="text-indigo-400 font-bold uppercase tracking-[0.4em] text-xs">Neural Education Engine</p>
          </div>
        </div>

        <div className="space-y-4">
          <button 
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-4 bg-white text-slate-900 py-4 px-6 rounded-2xl font-black transition-all hover:bg-slate-100 shadow-[0_10px_40px_rgba(255,255,255,0.1)] active:scale-95"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>
          
          <button 
            onClick={handleGuestLogin}
            className="w-full bg-slate-800/50 text-white py-4 px-6 rounded-2xl font-black transition-all hover:bg-slate-800 border border-white/5 shadow-2xl active:scale-95"
          >
            Access as Guest
          </button>
        </div>

        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
          Personalize your learning synapse
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;
