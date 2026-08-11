import {
  KeyRound, User, FolderTree, ShieldCheck, Server, Download, Settings2, Activity,
} from 'lucide-react';

/**
 * One source of truth for how an activity category looks, so the dashboard
 * feed and the Activity page never drift apart.
 */
export const CATEGORY_META = {
  auth:   { label: 'Auth',    icon: KeyRound,   tone: 'info'    },
  user:   { label: 'Users',   icon: User,       tone: 'ok'      },
  share:  { label: 'Shares',  icon: FolderTree, tone: 'signal'  },
  acl:    { label: 'ACLs',    icon: ShieldCheck,tone: 'warn'    },
  samba:  { label: 'Samba',   icon: Server,     tone: 'signal'  },
  update: { label: 'Updates', icon: Download,   tone: 'info'    },
  system: { label: 'System',  icon: Settings2,  tone: 'neutral' },
};

export const CATEGORIES = ['all', ...Object.keys(CATEGORY_META)];

export function categoryMeta(category) {
  return CATEGORY_META[category] || { label: category, icon: Activity, tone: 'neutral' };
}

/**
 * Turn a stored action key into readable text — "share_create" reads as
 * "Share create" in the UI rather than exposing the storage format.
 */
const ACRONYMS = new Set(['acl', 'acls', 'smb', 'api', 'id', 'ip', 'url', 'cpu', 'ram']);

export function humaniseAction(action) {
  if (!action) return '—';
  return String(action)
    .replace(/[_.]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w, i) => {
      if (ACRONYMS.has(w.toLowerCase())) return w.toUpperCase();
      return i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w;
    })
    .join(' ');
}
