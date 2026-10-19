import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here=dirname(fileURLToPath(import.meta.url));
const dbPath=resolve(process.env.LAS_DB_PATH||resolve(here,"data/asbl-las.sqlite"));
const source=process.argv[2];
if(!source)throw new Error("Usage: node import-data.js <export.json> (fichier exporté depuis Supabase, conservé hors Git)");
const payload=JSON.parse(readFileSync(resolve(process.cwd(),source),"utf8"));
const specs={
  members:["id","name","phone","email","profession","birthdate","birthplace","address","joined_on","position","forum_status","asbl_status","meeting_status","note","photo_path","birthday_visible","status","created_at","updated_at"],
  monthly_contributions:["id","member_id","contribution_year","contribution_month","amount","currency","paid_at","note","created_at"],
  member_payments:["id","member_id","payment_year","payment_month","paid","updated_at"],
  posts:["id","title","body","category","status","created_at","updated_at"],
  media_items:["id","media_type","title","description","external_url","storage_path","published_date","created_at","legacy_id","status"],
  post_comments:["id","post_id","body","status","created_at","updated_at"],
  tontine_periods:["id","title","starts_on","ends_on","contribution_amount","currency","status","created_at","updated_at"],
  tontine_entries:["id","period_id","member_id","amount","currency","status","paid_at","note","created_at","updated_at"],
  aid_requests:["id","member_id","subject","description","status","decision_note","decided_at","created_at","updated_at"]
};
const db=new Database(dbPath);db.pragma("foreign_keys=ON");
const counts={};
const importAll=db.transaction(()=>{
  for(const [table,columns] of Object.entries(specs)){
    const rows=payload[table];
    if(rows===undefined)continue;
    if(!Array.isArray(rows))throw new Error("La propriété "+table+" doit être un tableau.");
    let inserted=0,ignored=0;
    const sql="INSERT OR IGNORE INTO "+table+" ("+columns.join(",")+") VALUES ("+columns.map(()=>"?").join(",")+")";
    const stmt=db.prepare(sql);
    for(const row of rows){
      const values=columns.map(column=>row[column]===undefined?null:row[column]);
      // User IDs are deliberately not imported: passwords from Supabase Auth cannot be exported in plaintext.
      // Clear legacy actor IDs so imported records do not fail foreign-key checks.
      if(table==="monthly_contributions") values[columns.indexOf("recorded_by")]=undefined;
      try { const info=stmt.run(...values); if(info.changes)inserted++;else ignored++; }
      catch(error){throw new Error("Import "+table+" id="+row.id+": "+error.message);}
    }
    counts[table]={inserted,ignored};
  }
});
try{importAll();console.log(JSON.stringify({database:dbPath,counts},null,2));}
finally{db.close();}
