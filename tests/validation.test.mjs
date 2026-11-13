import test from 'node:test';
import assert from 'node:assert/strict';
import { contactSchema,dealSchema,taskSchema,mutationSchema } from '../lib/validation.ts';
test('contact rejects malformed emails and unexpected fields',()=>{assert.equal(contactSchema.safeParse({name:'A',email:'not-email',company:'B'}).success,false);assert.equal(contactSchema.safeParse({name:'A',email:'a@example.com',company:'B',owner:'other'}).success,false)});
test('contact trims whitespace and supplies safe defaults',()=>{const v=contactSchema.parse({name:' Ada ',email:'ada@example.com',company:' Acme '});assert.equal(v.name,'Ada');assert.equal(v.notes,'')});
test('deal rejects negative values, invalid stages and impossible dates',()=>{const good={name:'Deal',company:'Acme',value:100,stage:'Lead',closeDate:'2026-11-13'};for(const override of [{value:-1},{value:Infinity},{stage:'Invalid'},{closeDate:'2026-02-30'}])assert.equal(dealSchema.safeParse({...good,...override}).success,false);assert.equal(dealSchema.safeParse(good).success,true)});
test('task requires valid priority and boolean completion',()=>{assert.equal(taskSchema.safeParse({name:'Call',dueDate:'2026-11-13',priority:'High',completed:'true'}).success,false)});
test('mutation disallows owner override and invalid versions',()=>{assert.equal(mutationSchema.safeParse({kind:'contacts',owner:'victim'}).success,false);assert.equal(mutationSchema.safeParse({kind:'contacts',version:0}).success,false)});
