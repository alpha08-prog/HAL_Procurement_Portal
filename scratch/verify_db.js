import { get, all } from '../server/noting/db.js';

const memberCount = get('SELECT COUNT(*) AS c FROM members').c;
const unitCount = get('SELECT COUNT(*) AS c FROM org_units').c;
console.log(`Total Members in DB: ${memberCount}`);
console.log(`Total Org Units in DB: ${unitCount}`);

const sampleMembers = all('SELECT pb, name, designation, grade FROM members LIMIT 10');
console.log('Sample Members:', JSON.stringify(sampleMembers, null, 2));
