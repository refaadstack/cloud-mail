import BizError from '../error/biz-error';
import emailUtils from './email-utils';
import { t } from '../i18n/i18n';

// Per-domain admin support.
//
// `admin` env = global superadmin (unchanged, sees/manages everything).
// `admins` env = JSON map of extra domain admins, e.g.
//   '{"akadnya.com":"admin@akadnya.com"}'
// A domain admin passes admin-level gates but data reads/mutations are
// scoped to their own domain(s) by the calling service.
const adminUtils = {

	superAdminEmail(env) {
		return String((env && env.admin) || '').toLowerCase();
	},

	isSuperAdmin(env, email) {
		return !!email && String(email).toLowerCase() === this.superAdminEmail(env);
	},

	domainAdminMap(env) {
		try {
			const raw = env && env.admins;
			if (!raw) return {};
			const map = typeof raw === 'string' ? JSON.parse(raw) : raw;
			const out = {};
			for (const [domain, adminEmail] of Object.entries(map || {})) {
				if (domain && adminEmail) out[String(domain).toLowerCase()] = String(adminEmail).toLowerCase();
			}
			return out;
		} catch (e) {
			console.warn('bad admins env: ' + e.message);
			return {};
		}
	},

	// Domains this email administrates. Superadmin => all configured domains.
	adminDomains(env, email) {
		if (!email) return [];
		if (this.isSuperAdmin(env, email)) {
			const domains = (env && env.domain) || [];
			return Array.isArray(domains) ? domains.map(d => String(d).toLowerCase()) : [];
		}
		const needle = String(email).toLowerCase();
		return Object.entries(this.domainAdminMap(env))
			.filter(([, adminEmail]) => adminEmail === needle)
			.map(([domain]) => domain);
	},

	isAdmin(env, email) {
		if (!email) return false;
		return this.isSuperAdmin(env, email) || this.adminDomains(env, email).length > 0;
	},

	// Guard for admin mutations targeting another identity.
	// Superadmin always passes. Domain admin passes only when the target
	// email belongs to an administered domain. Anyone else is rejected
	// (defense in depth; the security middleware should have blocked them).
	assertCanManage(env, callerEmail, targetEmail) {
		if (this.isSuperAdmin(env, callerEmail)) return;
		const domains = this.adminDomains(env, callerEmail);
		if (domains.length === 0) throw new BizError(t('unauthorized'), 403);
		const targetDomain = emailUtils.getDomain(String(targetEmail || '').toLowerCase());
		if (!domains.includes(targetDomain)) throw new BizError(t('unauthorized'), 403);
	},
};

export default adminUtils;
