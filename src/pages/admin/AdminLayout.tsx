import { Outlet, NavLink } from 'react-router-dom';
import { Sun, Moon, BarChart3, Users, Store as StoreIcon, Flag, Headphones, DollarSign, TrendingUp, Ticket, Megaphone } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useTheme } from '../../components/ThemeProvider';
import { HeaderLogo } from '../../components/header/HeaderLogo';

const adminLinks = [
	{ to: '/admin/overview', label: 'Overview', icon: <BarChart3 size={20} /> },
	{ to: '/admin/users', label: 'Users', icon: <Users size={20} /> },
	{ to: '/admin/studios', label: '1Studio', icon: <Headphones size={20} /> },
	{ to: '/admin/stores', label: 'Stores', icon: <StoreIcon size={20} /> },
	{ to: '/admin/reports', label: 'Reports', icon: <Flag size={20} /> },
	{ to: '/admin/withdrawals', label: 'Withdrawals', icon: <DollarSign size={20} /> },
	{ to: '/admin/transfers', label: 'Transfers', icon: <TrendingUp size={20} /> },
	{ to: '/admin/tickets', label: 'Support', icon: <Ticket size={20} /> },
	{ to: '/admin/announcements', label: 'Announcements', icon: <Megaphone size={20} /> },
	{ to: '/admin/revenue', label: 'Revenue', icon: <DollarSign size={20} /> },
	{ to: '/admin/forecast', label: 'Forecast', icon: <BarChart3 size={20} /> },
];

const AdminLayout = () => {
	const { theme, setTheme } = useTheme();
	return (
		<div className="min-h-screen bg-gray-50 dark:bg-black">
			<header className="sticky top-0 z-30 bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 shadow-sm">
				<div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
					<div className="flex items-center gap-3">
						<HeaderLogo />
						<span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Admin</span>
					</div>
					<div className="flex items-center gap-4">
						<Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
							{theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
						</Button>
						<Button variant="outline" size="sm" asChild>
							<NavLink to="/">Back to App</NavLink>
						</Button>
					</div>
				</div>
				<nav className="max-w-7xl mx-auto px-2 flex justify-between items-center gap-1 bg-gray-100/80 dark:bg-gray-900/80 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-x-auto scrollbar-hide">
					{adminLinks.map(link => (
						<NavLink
							key={link.to}
							to={link.to}
							className={({ isActive }) =>
								`group flex flex-col items-center justify-center flex-1 min-w-[80px] h-16 px-2 py-1 relative transition-all duration-200 font-medium text-[12px] ${
									isActive
										? 'text-purple-700 dark:text-purple-200'
										: 'text-gray-600 dark:text-gray-300 hover:text-purple-700 dark:hover:text-purple-200'
								}`
							}
							style={{ textDecoration: 'none' }}
						>
							{({ isActive }) => (
								<>
									<span className="mb-1 z-10 flex items-center justify-center w-7 h-7 rounded-full bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 group-hover:scale-105 transition-transform">{link.icon}</span>
									<span className="leading-tight z-10 font-semibold tracking-wide">{link.label}</span>
									<span
										className={`absolute left-1/2 -translate-x-1/2 bottom-1 w-20 h-8 rounded-full transition-all duration-300 z-0 ${
											isActive
												? 'bg-purple-100 dark:bg-purple-900/60 shadow-lg scale-100'
												: 'scale-0'
										}`}
										aria-hidden="true"
									/>
								</>
							)}
						</NavLink>
					))}
				</nav>
			</header>
			<main className="max-w-7xl mx-auto px-4 pb-10 mt-8">
				<Outlet />
			</main>
		</div>
	);
};

export default AdminLayout;
