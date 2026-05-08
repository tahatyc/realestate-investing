export default function FilterBar({ filters, setFilters, leverageEnabled }) {
  function update(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-3 md:grid-cols-3 xl:grid-cols-6">
      <input className="input" placeholder="Zone" value={filters.zone ?? ''} onChange={(event) => update('zone', event.target.value)} />
      <select className="input" value={filters.type ?? ''} onChange={(event) => update('type', event.target.value)}>
        <option value="">All types</option>
        <option value="1-bedroom">1-bedroom</option>
        <option value="2-bedroom">2-bedroom</option>
        <option value="3-bedroom">3-bedroom</option>
        <option value="4-bedroom">4-bedroom</option>
        <option value="house">House</option>
      </select>
      <input className="input" type="number" placeholder="Min price" value={filters.minPrice ?? ''} onChange={(event) => update('minPrice', event.target.value)} />
      <input className="input" type="number" placeholder="Max price" value={filters.maxPrice ?? ''} onChange={(event) => update('maxPrice', event.target.value)} />
      <select className="input" value={filters.condition ?? ''} onChange={(event) => update('condition', event.target.value)}>
        <option value="">All conditions</option>
        <option value="needs_rehab">Needs rehab</option>
        <option value="partially_renovated">Partially renovated</option>
        <option value="fully_renovated">Fully renovated</option>
        <option value="new">New</option>
        <option value="unknown">Unknown</option>
      </select>
      {leverageEnabled ? (
        <select className="input" value={filters.health ?? ''} onChange={(event) => update('health', event.target.value)}>
          <option value="">All health</option>
          <option value="green">Green</option>
          <option value="yellow">Yellow</option>
          <option value="red">Red</option>
        </select>
      ) : null}
    </div>
  );
}
