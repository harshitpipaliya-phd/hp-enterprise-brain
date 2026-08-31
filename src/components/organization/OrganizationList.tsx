import { Building2 } from 'lucide-react';
import type { Organization } from '../../App';
import { DataTable, EmptyState, PageHeader, StatusBadge } from '../../ui';
import type { Column } from '../../ui';

interface Props {
  organizations: Organization[];
  loading: boolean;
  onSelect: (org: Organization) => void;
  onEdit: (org: Organization) => void;
  onArchive: (org: Organization) => void;
}

/**
 * The organization chooser.
 *
 * TWO THINGS WERE WRONG HERE. The name cell was an `<a href="#">` with a
 * preventDefault handler — a link that goes nowhere, announced to a screen
 * reader as a link, and offering a middle-click that opens a blank tab. And the
 * Edit button navigated to the `edit` view, which App.tsx stopped rendering when
 * organization editing moved inline onto the organization page: there is no
 * `view === 'edit'` branch left, so the button reliably produced an empty
 * content pane. It now opens the organization, which is where the edit form
 * lives.
 *
 * The hand-rolled table with inline `#ddd` borders is replaced by the shared
 * DataTable, so this screen inherits the same header, spacing, empty state,
 * loading skeleton and small-screen restacking as every other list in the
 * product.
 */
export default function OrganizationList({ organizations, loading, onSelect, onEdit, onArchive }: Props) {
  /*
    A COLUMN THAT CAN NEVER HAVE A VALUE IS NOT A COLUMN.

    Country, industry and code exist only where the connected source system
    keeps them, and each organization publishes which of them it can hold. A
    tenant whose ERP has no country column got a Country column of "Not
    recorded" on every row — a full column of the table saying nothing, which is
    worse than not asking.

    `some` rather than `every`: with two organizations from different source
    systems, a column one of them can fill is still worth showing. The other
    row then reads "Not recorded", which in that context is a real fact about
    that organization rather than about the product.
  */
  const holds = (field: 'orgCode' | 'industry' | 'country'): boolean =>
    organizations.some((org) => {
      const universal = field === 'orgCode' ? 'orgCode' : field;
      return [...(org.identityFields ?? []), ...(org.profileFields ?? [])].includes(universal as never)
        || Boolean(org[field]);
    });

  const optional: Array<Column<Organization>> = [
    holds('orgCode') ? {
      key: 'orgCode',
      header: 'Code',
      secondary: true,
      render: (org: Organization) => org.orgCode || <span className="u-muted">Not set</span>,
    } : null,
    holds('industry') ? {
      key: 'industry',
      header: 'Industry',
      secondary: true,
      render: (org: Organization) => org.industry || <span className="u-muted">Not recorded</span>,
    } : null,
    holds('country') ? {
      key: 'country',
      header: 'Country',
      secondary: true,
      render: (org: Organization) => org.country || <span className="u-muted">Not recorded</span>,
    } : null,
  ].filter(Boolean) as Array<Column<Organization>>;

  const columns: Array<Column<Organization>> = [
    {
      key: 'name',
      header: 'Organization',
      render: (org) => (
        <button type="button" className="eb-link-btn" onClick={() => onSelect(org)}>{org.name}</button>
      ),
    },
    ...optional,
    {
      key: 'status',
      header: 'Status',
      render: (org) => (
        <StatusBadge tone={String(org.status).toLowerCase() === 'active' ? 'success' : 'warning'}>
          {org.status || 'unknown'}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (org) => (
        <div className="u-row u-gap-2">
          <button type="button" className="eb-pill-btn" onClick={() => onSelect(org)}>Open</button>
          <button type="button" className="eb-pill-btn" onClick={() => onEdit(org)}>Edit</button>
          <button type="button" className="eb-pill-btn" onClick={() => onArchive(org)}>Archive</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        variant="list"
        icon={<Building2 />}
        title="Organizations"
        description="Every organization this account can reach. Open one to work with its data."
      />
      <DataTable
        rows={organizations}
        columns={columns}
        rowKey={(org) => org.id}
        loading={loading}
        caption="Organizations available to this account"
        empty={(
          <EmptyState
            icon={<Building2 />}
            title="No organization is available for this account"
            description="Organizations come from the connected source system. If you expected one here, check that this account is linked to it."
          />
        )}
      />
    </div>
  );
}
