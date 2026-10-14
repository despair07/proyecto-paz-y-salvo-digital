import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

const Layout = ({ children, title }) => {
  return (
    <div className="flex bg-[#F8FAFC] min-h-screen font-sans text-slate-800">
      <Sidebar />
      <div className="flex-1 md:ml-64 flex flex-col min-w-0">
        <Header title={title} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
