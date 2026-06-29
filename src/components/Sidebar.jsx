import { ChevronDown, ChevronRight, Tag } from 'lucide-react'

function renderSidebarTree(nodes, depth, language, selectedCategory, setSelectedCategory, expandedRoot, setExpandedRoot) {
  return nodes.map(node => {
    const hasChildren = node.children?.length > 0
    const isRoot = depth === 0
    const isExpanded = isRoot ? expandedRoot === node.key : true
    return (
      <div key={node.key} className={`sidebar-tree-node depth-${depth}`}>
        <button
          type="button"
          className={selectedCategory === node.key ? 'active' : ''}
          onClick={() => {
            setSelectedCategory(node.key)
            if (isRoot && hasChildren)
              setExpandedRoot(prev => prev === node.key ? null : node.key)
          }}
        >
          {isRoot && hasChildren && (
            <span className="sidebar-chevron">
              {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </span>
          )}
          {node.name[language] || node.key}
        </button>
        {hasChildren && isExpanded && (
          <div className="sidebar-tree-children">
            {renderSidebarTree(node.children, depth + 1, language, selectedCategory, setSelectedCategory, expandedRoot, setExpandedRoot)}
          </div>
        )}
      </div>
    )
  })
}

export function Sidebar({
  categoryTree,
  selectedCategory, setSelectedCategory,
  language,
  locale,
  expandedRoot, setExpandedRoot,
}) {
  return (
    <aside className="sidebar-categories" aria-label="Категории">
      <div className="sidebar-card">
        <h3>Категории</h3>
        <nav className="sidebar-list">
          <div className="sidebar-tree-node depth-0">
            <button
              type="button"
              className={selectedCategory === 'all' ? 'active' : ''}
              onClick={() => setSelectedCategory('all')}
            >
              <Tag size={13} />
              {locale.categoryAll}
            </button>
          </div>
          {renderSidebarTree(categoryTree, 0, language, selectedCategory, setSelectedCategory, expandedRoot, setExpandedRoot)}
        </nav>
      </div>
    </aside>
  )
}
