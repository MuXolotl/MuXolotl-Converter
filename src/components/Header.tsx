import React from 'react';

const Header: React.FC = React.memo(() => {
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xl">🦎</span>
      <h1 className="text-2xl font-bold gradient-text">MuXolotl-Converter</h1>
      <span className="text-white/40 text-sm ml-2">High-Performance Media Converter</span>
    </div>
  );
});

Header.displayName = 'Header';

export default Header;
