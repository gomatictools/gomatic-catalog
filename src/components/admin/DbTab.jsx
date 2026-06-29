export function DbTab({ exportProducts, importProductsFromFile }) {
  return (
    <div className="admin-section">
      <h3>Управување со база</h3>
      <div className="db-actions">
        <div className="db-action-group">
          <h4>Производи</h4>
          <p>Извоз или увоз на листата на производи во JSON формат.</p>
          <div className="admin-actions">
            <button type="button" onClick={exportProducts}>Извоз JSON</button>
            <label className="import-file">
              Увоз JSON
              <input type="file" accept="application/json" style={{ display: 'none' }} onChange={e => importProductsFromFile(e.target.files?.[0])} />
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
