import {
  LayoutDashboard, Calendar, Users, Package, GraduationCap,
  ClipboardCheck, ShoppingBag, DollarSign, BarChart3,
  User, BookOpen, History, Wallet,
} from 'lucide-react';

export const adminNav = [
  { to: '/admin',            label: 'Overview',   icon: LayoutDashboard, end: true },
  { to: '/admin/schedule',   label: 'Schedule',   icon: Calendar },
  { to: '/admin/clients',    label: 'Clients',    icon: Users },
  { to: '/admin/packages',   label: 'Packages',   icon: Package },
  { to: '/admin/trainers',   label: 'Trainers',   icon: GraduationCap },
  { to: '/admin/attendance', label: 'Attendance', icon: ClipboardCheck },
  { to: '/admin/pos',        label: 'POS / Shop', icon: ShoppingBag },
  { to: '/admin/finance',    label: 'Finance',    icon: DollarSign },
  { to: '/admin/reports',    label: 'Reports',    icon: BarChart3 },
];

export const trainerNav = [
  { to: '/trainer',          label: 'Schedule', icon: Calendar, end: true },
  { to: '/trainer/payments', label: 'Payments', icon: Wallet },
];

export const clientNav = [
  { to: '/client',         label: 'My Profile', icon: User,    end: true },
  { to: '/client/book',    label: 'Book Class', icon: BookOpen },
  { to: '/client/history', label: 'History',    icon: History },
];

export function navForRole(role) {
  if (role === 'admin')   return adminNav;
  if (role === 'trainer') return trainerNav;
  if (role === 'client')  return clientNav;
  return [];
}
