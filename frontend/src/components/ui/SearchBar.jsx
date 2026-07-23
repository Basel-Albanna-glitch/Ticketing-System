import Input from './Input'
import { SearchIcon } from './icons'

export default function SearchBar({ value, onChange, placeholder = 'Search…', className = '' }) {
  return (
    <div className={`w-full max-w-xs ${className}`}>
      <Input
        icon={SearchIcon}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
