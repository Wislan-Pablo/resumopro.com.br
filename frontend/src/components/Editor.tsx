import JoditEditor from 'jodit-react'
import { useState } from 'react'

export default function Editor() {
  const [value, setValue] = useState('')
  return (
    <div className="max-w-4xl">
      <JoditEditor value={value} onChange={setValue} />
    </div>
  )
}
