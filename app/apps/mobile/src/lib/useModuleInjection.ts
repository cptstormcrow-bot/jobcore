import { useEffect } from 'react';
import { setModuleSession, clearModuleSession } from '@jobcore/admin-finance';
import { setModulePorts as setAdminFinanceModulePorts } from '../../../../modules/admin-finance/src/lib/module-ports';
import {
  setModuleSession as setFieldTechModuleSession,
  clearModuleSession as clearFieldTechModuleSession,
} from '../../../../modules/field-tech/src/lib/module-session';
import { setModulePorts as setFieldTechModulePorts } from '../../../../modules/field-tech/src/lib/module-ports';
import {
  setModuleSession as setSalesMarketingModuleSession,
  clearModuleSession as clearSalesMarketingModuleSession,
  setModulePorts as setSalesMarketingModulePorts,
} from '../../../../modules/sales-marketing/src/index';

import { useSession } from './session';
import { buildAdminFinancePorts } from './admin-finance-repos';
import { buildFieldTechPorts } from './field-tech-repos';
import { buildSalesMarketingPorts } from './sales-marketing-repos';

/**
 * Host-side injection of the session + ports seams for the admin-finance,
 * field-tech and sales-marketing modules. Shared by every host screen that
 * runs module code (the module screen, the Job detail screen).
 *
 * Injection runs SYNCHRONOUSLY in the render body, not a `useEffect`: React
 * fires child effects before parent effects on mount, so an effect ran AFTER
 * the module's own screen had already mounted and read a stale (uninjected)
 * session. The setters are plain module-scope writes — idempotent — so calling
 * them every render is safe; only the CLEANUP lives in an effect, scoped to
 * `activeModuleId` alone so it fires on module switch / unmount.
 *
 * Call it in the render body of the screen, BEFORE rendering anything that
 * reads the module seams, with the session state from `useSession()` and the
 * id of the module being shown (undefined / unmatched id injects nothing).
 */
export function useModuleInjection(
  state: ReturnType<typeof useSession>,
  activeModuleId: string | undefined,
): void {
  if (state.status === 'authenticated' && activeModuleId === 'admin-finance') {
    setModuleSession({
      org: state.organization,
      role: state.profile.role,
      userId: state.profile.id,
    });
    setAdminFinanceModulePorts(buildAdminFinancePorts());
  }
  useEffect(() => {
    if (activeModuleId !== 'admin-finance') return undefined;
    return () => clearModuleSession();
  }, [activeModuleId]);

  if (state.status === 'authenticated' && activeModuleId === 'field-tech') {
    setFieldTechModuleSession({
      org: state.organization,
      role: state.profile.role,
      userId: state.profile.id,
    });
    setFieldTechModulePorts(buildFieldTechPorts());
  }
  useEffect(() => {
    if (activeModuleId !== 'field-tech') return undefined;
    return () => clearFieldTechModuleSession();
  }, [activeModuleId]);

  if (state.status === 'authenticated' && activeModuleId === 'sales-marketing') {
    setSalesMarketingModuleSession({
      org: state.organization,
      role: state.profile.role,
      userId: state.profile.id,
    });
    setSalesMarketingModulePorts(buildSalesMarketingPorts());
  }
  useEffect(() => {
    if (activeModuleId !== 'sales-marketing') return undefined;
    return () => clearSalesMarketingModuleSession();
  }, [activeModuleId]);
}
