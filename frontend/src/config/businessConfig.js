// SINGLE SOURCE OF TRUTH for all business-type-specific configuration.
//
// When adding a new business type:
//   1. Add an entry here (all 8 sections below)
//   2. Add navItems here (they'll auto-appear in the sidebar)
//   3. Add routes + page files:  frontend/src/pages/<type>/ + App.jsx
//   4. Add ROLE_DEFAULT_CONFIGS: backend/app/models/user.py

import {
  LayoutDashboard, Receipt, Table2, ShoppingCart, ChefHat,
  Package, Warehouse, Truck, TrendingDown, BarChart2, Users,
  Store, ClipboardList, Shield, Scissors, Tag, FileText, CalendarDays,
} from 'lucide-react'

export const BUSINESS_CONFIG = {

  // ─── Bar & Restaurant ──────────────────────────────────────────────────────
  bar_restaurant: {
    label: 'Bar & Restaurant',

    // Admin Feature Access toggles (TenantDetail.jsx)
    featureList: [
      { key: 'dashboard',     label: 'Dashboard & Daily Summary' },
      { key: 'billing',       label: 'Counter Billing' },
      { key: 'table_billing', label: 'Table Billing' },
      { key: 'tables',        label: 'Tables' },
      { key: 'orders',        label: 'Orders' },
      { key: 'kot',           label: 'Kitchen / KOT' },
      { key: 'sales_log',     label: 'Sales Log' },
      { key: 'products',      label: 'Products' },
      { key: 'inventory',     label: 'Inventory' },
      { key: 'purchases',     label: 'Purchases' },
      { key: 'expenses',      label: 'Expenses' },
      { key: 'reports',       label: 'Reports' },
      { key: 'users',         label: 'Users & Roles' },
      { key: 'roles',         label: 'Role Permissions' },
      { key: 'outlets',       label: 'Outlets' },
      { key: 'support',       label: 'Support' },
    ],

    // Role Permissions page list (RolePermissions.jsx)
    rolePages: [
      { key: 'dashboard',     label: 'Dashboard',        icon: LayoutDashboard },
      { key: 'billing',       label: 'Counter Billing',  icon: Receipt },
      { key: 'table_billing', label: 'Table Billing',    icon: Table2 },
      { key: 'orders',        label: 'Orders',           icon: ShoppingCart },
      { key: 'tables',        label: 'Tables',           icon: Table2 },
      { key: 'sales_log',     label: 'Sales Log',        icon: ClipboardList },
      { key: 'kot',           label: 'Kitchen / KOT',    icon: ChefHat },
      { key: 'products',      label: 'Products',         icon: Package },
      { key: 'inventory',     label: 'Inventory',        icon: Warehouse },
      { key: 'purchases',     label: 'Purchases',        icon: Truck },
      { key: 'expenses',      label: 'Expenses',         icon: TrendingDown },
      { key: 'reports',       label: 'Reports',          icon: BarChart2 },
      { key: 'users',         label: 'Users & Roles',    icon: Users },
      { key: 'roles',         label: 'Role Permissions', icon: Shield },
      { key: 'outlets',       label: 'Outlets',          icon: Store },
    ],

    // Role Permissions action groups (RolePermissions.jsx)
    actionGroups: [
      {
        label: 'Billing',
        actions: [
          { key: 'billing.view',        label: 'View bills & invoices' },
          { key: 'billing.create',      label: 'Create new bill' },
          { key: 'billing.cancel_own',  label: 'Cancel own bills' },
          { key: 'billing.cancel',      label: 'Cancel any bill' },
          { key: 'billing.discount',    label: 'Apply discounts' },
        ],
      },
      {
        label: 'Orders & Tables',
        actions: [
          { key: 'orders.view',   label: 'View orders' },
          { key: 'orders.create', label: 'Create / add items to order' },
          { key: 'orders.edit',   label: 'Edit order items' },
          { key: 'orders.cancel', label: 'Cancel orders' },
          { key: 'tables.view',   label: 'View table status' },
          { key: 'tables.update', label: 'Update table status' },
        ],
      },
      {
        label: 'Kitchen',
        actions: [
          { key: 'kot.view',   label: 'View KOT tickets' },
          { key: 'kot.update', label: 'Update KOT status' },
        ],
      },
      {
        label: 'Inventory & Purchases',
        actions: [
          { key: 'inventory.view',    label: 'View stock levels' },
          { key: 'inventory.adjust',  label: 'Adjust stock' },
          { key: 'purchases.view',    label: 'View purchase orders' },
          { key: 'purchases.create',  label: 'Create purchase orders' },
          { key: 'purchases.approve', label: 'Approve purchases' },
          { key: 'purchases.receive', label: 'Mark purchases as received' },
        ],
      },
      {
        label: 'Expenses',
        actions: [
          { key: 'expenses.view',    label: 'View expenses' },
          { key: 'expenses.create',  label: 'Record new expenses' },
          { key: 'expenses.approve', label: 'Approve expenses' },
        ],
      },
      {
        label: 'Reports',
        actions: [
          { key: 'reports.view',   label: 'View reports & analytics' },
          { key: 'reports.export', label: 'Export data to Excel (all pages)' },
        ],
      },
      {
        label: 'Users',
        actions: [
          { key: 'users.view',   label: 'View staff list' },
          { key: 'users.create', label: 'Add new users' },
          { key: 'users.edit',   label: 'Edit user details & roles' },
        ],
      },
    ],

    // Role Permissions approval options (RolePermissions.jsx)
    approvalOptions: [
      { key: 'billing.cancel',        label: 'Bill cancellation requires manager approval' },
      { key: 'billing.discount_high', label: 'Discount above 10% requires manager approval' },
      { key: 'orders.cancel',         label: 'Order cancellation requires manager approval' },
      { key: 'expenses.create',       label: 'Recording expenses requires approval' },
      { key: 'purchases.approve',     label: 'Purchase orders require manager approval' },
    ],

    // Sidebar nav items specific to this business type (CustomerLayout.jsx)
    navItems: [
      { to: '/app/daily',        icon: CalendarDays, label: 'Daily Summary',   permission: 'dashboard' },
      { to: '/app/billing',      icon: Receipt,      label: 'Counter Billing', permission: 'billing' },
      { to: '/app/table-billing',icon: Table2,       label: 'Table Billing',   permission: 'table_billing' },
      { to: '/app/tables',       icon: Table2,       label: 'Tables',          permission: 'tables' },
      { to: '/app/orders',       icon: ShoppingCart, label: 'Orders',          permission: 'orders' },
      { to: '/app/sales-log',    icon: ClipboardList,label: 'Sales Log',       permission: 'sales_log' },
      { to: '/app/kot',          icon: ChefHat,      label: 'Kitchen / KOT',   permission: 'kot' },
      { to: '/app/products',     icon: Package,      label: 'Products',        permission: 'products' },
      { to: '/app/inventory',    icon: Warehouse,    label: 'Inventory',       permission: 'inventory' },
      { to: '/app/purchases',    icon: Truck,        label: 'Purchases',       permission: 'purchases' },
      { to: '/app/expenses',     icon: TrendingDown, label: 'Expenses',        permission: 'expenses' },
      { to: '/app/reports',      icon: BarChart2,    label: 'Reports',         permission: 'reports' },
    ],

    // authStore getHomeRoute ordered pages
    orderedPages: [
      { path: '/app/dashboard',     permission: 'dashboard' },
      { path: '/app/table-billing', permission: 'table_billing' },
      { path: '/app/billing',       permission: 'billing' },
      { path: '/app/orders',        permission: 'orders' },
      { path: '/app/tables',        permission: 'tables' },
      { path: '/app/kot',           permission: 'kot' },
      { path: '/app/sales-log',     permission: 'sales_log' },
      { path: '/app/inventory',     permission: 'inventory' },
      { path: '/app/products',      permission: 'products' },
      { path: '/app/purchases',     permission: 'purchases' },
      { path: '/app/expenses',      permission: 'expenses' },
      { path: '/app/reports',       permission: 'reports' },
      { path: '/app/users',         permission: 'users' },
      { path: '/app/roles',         permission: 'roles' },
      { path: '/app/outlets',       permission: 'outlets' },
    ],

    // Roles available for this business type (RolePermissions.jsx + Users.jsx)
    roles: [
      { key: 'owner',             label: 'Owner',             color: 'badge-orange', locked: true },
      { key: 'admin',             label: 'Admin',             color: 'badge-red' },
      { key: 'manager',           label: 'Manager',           color: 'badge-blue' },
      { key: 'cashier',           label: 'Cashier',           color: 'badge-green' },
      { key: 'waiter',            label: 'Waiter',            color: 'badge-blue' },
      { key: 'kitchen',           label: 'Kitchen Staff',     color: 'badge-yellow' },
      { key: 'inventory_manager', label: 'Inventory Manager', color: 'badge-gray' },
      { key: 'accountant',        label: 'Accountant',        color: 'badge-gray' },
    ],

    // authStore FALLBACK_ROLE_PAGES contribution per role
    fallbackPages: {
      admin:             ['dashboard', 'billing', 'table_billing', 'orders', 'tables', 'sales_log',
                          'kot', 'products', 'inventory', 'purchases', 'expenses', 'reports', 'users', 'roles', 'outlets'],
      manager:           ['dashboard', 'billing', 'table_billing', 'orders', 'tables', 'sales_log',
                          'kot', 'inventory', 'expenses', 'reports'],
      cashier:           ['dashboard', 'billing', 'table_billing', 'sales_log'],
      waiter:            ['dashboard', 'table_billing', 'orders', 'tables'],
      kitchen:           ['dashboard', 'kot'],
      inventory_manager: ['dashboard', 'products', 'inventory', 'purchases'],
      accountant:        ['dashboard', 'expenses', 'reports', 'sales_log'],
    },
  },

  // ─── Salon / Spa ────────────────────────────────────────────────────────────
  saloon: {
    label: 'Salon / Spa',

    // Admin Feature Access toggles (TenantDetail.jsx)
    featureList: [
      { key: 'dashboard',       label: 'Dashboard' },
      { key: 'salon_summary',   label: 'Summary' },
      { key: 'salon_billing',   label: 'Salon Billing' },
      { key: 'salon_bills_log', label: 'Bills Log' },
      { key: 'salon_services',  label: 'Services & Packages' },
      { key: 'salon_coupons',  label: 'Coupons' },
      { key: 'expenses',       label: 'Expenses' },
      { key: 'reports',        label: 'Reports' },
      { key: 'users',          label: 'Users & Roles' },
      { key: 'roles',          label: 'Role Permissions' },
      { key: 'outlets',        label: 'Outlets' },
      { key: 'support',        label: 'Support' },
    ],

    // Role Permissions page list (RolePermissions.jsx)
    rolePages: [
      { key: 'dashboard',       label: 'Dashboard',           icon: LayoutDashboard },
      { key: 'salon_summary',   label: 'Summary',             icon: FileText },
      { key: 'salon_billing',   label: 'Salon Billing',       icon: Receipt },
      { key: 'salon_bills_log', label: 'Bills Log',           icon: ClipboardList },
      { key: 'salon_services',  label: 'Services & Packages', icon: Scissors },
      { key: 'salon_coupons',  label: 'Coupons',             icon: Tag },
      { key: 'expenses',       label: 'Expenses',            icon: TrendingDown },
      { key: 'reports',        label: 'Reports',             icon: BarChart2 },
      { key: 'users',          label: 'Users & Roles',       icon: Users },
      { key: 'roles',          label: 'Role Permissions',    icon: Shield },
      { key: 'outlets',        label: 'Outlets',             icon: Store },
    ],

    // Role Permissions action groups (RolePermissions.jsx)
    actionGroups: [
      {
        label: 'Salon Billing',
        actions: [
          { key: 'billing.view',       label: 'View bills & invoices' },
          { key: 'billing.create',     label: 'Create new bill' },
          { key: 'billing.cancel_own', label: 'Cancel own bills' },
          { key: 'billing.cancel',     label: 'Cancel any bill' },
          { key: 'billing.discount',   label: 'Apply discounts' },
        ],
      },
      {
        label: 'Expenses',
        actions: [
          { key: 'expenses.view',    label: 'View expenses' },
          { key: 'expenses.create',  label: 'Record new expenses' },
          { key: 'expenses.approve', label: 'Approve expenses' },
        ],
      },
      {
        label: 'Reports',
        actions: [
          { key: 'reports.view',   label: 'View reports & analytics' },
          { key: 'reports.export', label: 'Export data' },
        ],
      },
      {
        label: 'Users',
        actions: [
          { key: 'users.view',   label: 'View staff list' },
          { key: 'users.create', label: 'Add new users' },
          { key: 'users.edit',   label: 'Edit user details & roles' },
        ],
      },
    ],

    // Role Permissions approval options (RolePermissions.jsx)
    approvalOptions: [
      { key: 'billing.cancel',        label: 'Bill cancellation requires manager approval' },
      { key: 'billing.discount_high', label: 'Discount above 10% requires manager approval' },
      { key: 'expenses.create',       label: 'Recording expenses requires approval' },
    ],

    // Sidebar nav items specific to this business type (CustomerLayout.jsx)
    navItems: [
      { to: '/app/salon/billing',  icon: Receipt,      label: 'Billing',         permission: 'salon_billing' },
      { to: '/app/salon/bills',    icon: ClipboardList,label: 'Bills Log',       permission: 'salon_bills_log' },
      { to: '/app/salon/services', icon: Scissors,     label: 'Services',        permission: 'salon_services' },
      { to: '/app/salon/coupons',  icon: Tag,          label: 'Coupons',         permission: 'salon_coupons' },
      { to: '/app/expenses',       icon: TrendingDown, label: 'Expenses',        permission: 'expenses' },
      { to: '/app/salon/reports',  icon: BarChart2,    label: 'Reports',         permission: 'reports' },
      { to: '/app/salon/summary',  icon: FileText,     label: 'Summary',         permission: 'salon_summary' },
    ],

    // authStore getHomeRoute ordered pages
    orderedPages: [
      { path: '/app/dashboard',      permission: 'dashboard' },
      { path: '/app/salon/summary',  permission: 'salon_summary' },
      { path: '/app/salon/billing',  permission: 'salon_billing' },
      { path: '/app/salon/bills',    permission: 'salon_bills_log' },
      { path: '/app/salon/services', permission: 'salon_services' },
      { path: '/app/salon/coupons',  permission: 'salon_coupons' },
      { path: '/app/expenses',       permission: 'expenses' },
      { path: '/app/salon/reports',  permission: 'reports' },
      { path: '/app/users',          permission: 'users' },
      { path: '/app/roles',          permission: 'roles' },
      { path: '/app/outlets',        permission: 'outlets' },
    ],

    // Roles available for this business type (RolePermissions.jsx + Users.jsx)
    roles: [
      { key: 'owner',             label: 'Owner',             color: 'badge-orange', locked: true },
      { key: 'admin',             label: 'Admin',             color: 'badge-red' },
      { key: 'manager',           label: 'Manager',           color: 'badge-blue' },
      { key: 'cashier',           label: 'Receptionist',      color: 'badge-green' },
      { key: 'inventory_manager', label: 'Inventory Manager', color: 'badge-gray' },
      { key: 'accountant',        label: 'Accountant',        color: 'badge-gray' },
    ],

    // authStore FALLBACK_ROLE_PAGES contribution per role
    fallbackPages: {
      admin:   ['dashboard', 'salon_billing', 'salon_bills_log', 'salon_services', 'salon_coupons', 'salon_summary',
                'expenses', 'reports', 'users', 'roles', 'outlets'],
      manager: ['dashboard', 'salon_billing', 'salon_bills_log', 'salon_services', 'salon_summary', 'expenses', 'reports'],
      cashier: ['dashboard', 'salon_billing', 'salon_bills_log'],
    },
  },
}
