// Barrel for core/types/*. Frozen and append-only per the plan's contested-files table (W0.11):
// each domain file below has its own owner from Wave 1 onward — add new files/exports here,
// don't restructure what's already exported without a wave-boundary discussion.

export * from './document';
export * from './permissions';
export * from './field';
export * from './form';
export * from './list';
export * from './extension';
export * from './events';
