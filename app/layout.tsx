import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Nexora CRM | Your next opportunity',description:'A focused workspace for relationships, deals, and follow-ups.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
