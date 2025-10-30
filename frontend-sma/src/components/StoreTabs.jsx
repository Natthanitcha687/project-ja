import { NavLink } from 'react-router-dom'

export default function StoreTabs() {
  return (
    <div className="mb-6 flex items-center justify-between">
      <div className="flex-1">
        <div className="inline-flex items-center rounded-full bg-white p-1 shadow-sm">
          <NavLink
            to="/dashboard/store"
            className={({ isActive }) =>
              `px-4 py-2 text-sm font-medium rounded-full transition ${isActive ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-sky-50'}`
            }
          >
            ภาพรวม
          </NavLink>
          <NavLink
            to="/dashboard/warranty"
            className={({ isActive }) =>
              `px-4 py-2 text-sm font-medium rounded-full transition ${isActive ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-sky-50'}`
            }
          >
            การรับประกัน
          </NavLink>
        </div>
      </div>
    </div>
  )
}
