import express from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import path from "path";
import {fileURLToPath} from "url";

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const app=express(), db=new Database(process.env.DB_PATH || path.join(__dirname, "kapnanda.db"));
app.use(express.json({limit:"5mb"}));
app.use(express.urlencoded({extended:true}));
app.use(session({secret:process.env.SESSION_SECRET||"change-this-secret",resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production"}}));
app.use(express.static(path.join(__dirname,"public")));

db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1),school_name TEXT NOT NULL,term TEXT NOT NULL,year INTEGER NOT NULL,default_fee REAL DEFAULT 800,phone TEXT,email TEXT,address TEXT,logo TEXT);
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS classes(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE NOT NULL,section TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS subjects(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE NOT NULL,section TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS teachers(id INTEGER PRIMARY KEY AUTOINCREMENT,staff_no TEXT UNIQUE,name TEXT NOT NULL,phone TEXT,email TEXT,status TEXT DEFAULT 'Active');
CREATE TABLE IF NOT EXISTS teacher_subjects(teacher_id INTEGER,subject_id INTEGER,class_id INTEGER,PRIMARY KEY(teacher_id,subject_id,class_id));
CREATE TABLE IF NOT EXISTS learners(id INTEGER PRIMARY KEY AUTOINCREMENT,admission_no TEXT UNIQUE NOT NULL,name TEXT NOT NULL,gender TEXT,dob TEXT,class_id INTEGER,parent_name TEXT,parent_phone TEXT,address TEXT,status TEXT DEFAULT 'Active');
CREATE TABLE IF NOT EXISTS exams(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,term TEXT,year INTEGER);
CREATE TABLE IF NOT EXISTS marks(id INTEGER PRIMARY KEY AUTOINCREMENT,exam_id INTEGER,learner_id INTEGER,subject_id INTEGER,mark REAL,UNIQUE(exam_id,learner_id,subject_id));
CREATE TABLE IF NOT EXISTS payments(id INTEGER PRIMARY KEY AUTOINCREMENT,learner_id INTEGER,term TEXT,year INTEGER,amount REAL,method TEXT,receipt_no TEXT UNIQUE,date TEXT);
CREATE TABLE IF NOT EXISTS attendance(id INTEGER PRIMARY KEY AUTOINCREMENT,learner_id INTEGER,date TEXT,status TEXT,UNIQUE(learner_id,date));
CREATE TABLE IF NOT EXISTS timetable(id INTEGER PRIMARY KEY AUTOINCREMENT,day TEXT,time_slot TEXT,class_id INTEGER,subject_id INTEGER,teacher_id INTEGER,activity TEXT);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,action TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);
if(!db.prepare("SELECT 1 FROM settings WHERE id=1").get()) db.prepare("INSERT INTO settings(id,school_name,term,year,default_fee) VALUES(1,?,?,?,?)").run("Kapnanda Primary & Junior School","Term 3",2026,800);
if(!db.prepare("SELECT 1 FROM users LIMIT 1").get()) db.prepare("INSERT INTO users(username,password,role) VALUES(?,?,?)").run("admin",bcrypt.hashSync("Admin@123",10),"ADMIN");

const classNames=["PP1","PP2","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7","Grade 8","Grade 9"];
const primary=["PP1","PP2","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6"];
const junior=["Grade 7","Grade 8","Grade 9"];
const subMap={
primary:["English","Kiswahili","Mathematics","Environmental Activities","Science & Technology","Agriculture","Social Studies","Creative Arts & Sports","Religious Education"],
junior:["English","Kiswahili","Mathematics","Integrated Science","Agriculture","Social Studies","Creative Arts & Sports","Pre-Technical Studies","Religious Education"]
};
const addClass=db.prepare("INSERT OR IGNORE INTO classes(name,section) VALUES(?,?)");
for(const c of classNames)addClass.run(c,junior.includes(c)?"Junior":"Primary");
const addSub=db.prepare("INSERT OR IGNORE INTO subjects(name,section) VALUES(?,?)");
for(const s of subMap.primary)addSub.run(s,"Primary");
for(const s of subMap.junior)addSub.run(s,"Junior");

function auth(req,res,next){if(!req.session.user)return res.status(401).json({error:"Not authenticated"});next()}
function role(...roles){return (req,res,next)=>roles.includes(req.session.user.role)?next():res.status(403).json({error:"Permission denied"})}
function log(req,action){db.prepare("INSERT INTO audit(user_id,action) VALUES(?,?)").run(req.session.user.id,action)}

app.post("/api/login",(req,res)=>{const u=db.prepare("SELECT * FROM users WHERE username=?").get(req.body.username);if(!u||!bcrypt.compareSync(req.body.password,u.password))return res.status(401).json({error:"Invalid username or password"});req.session.user={id:u.id,username:u.username,role:u.role};res.json({user:req.session.user})});
app.post("/api/logout",auth,(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get("/api/me",(req,res)=>res.json({user:req.session.user||null}));

app.get("/api/dashboard",auth,(req,res)=>{
 const learners=db.prepare("SELECT COUNT(*) n FROM learners WHERE status='Active'").get().n;
 const teachers=db.prepare("SELECT COUNT(*) n FROM teachers WHERE status='Active'").get().n;
 const paid=db.prepare("SELECT COALESCE(SUM(amount),0) n FROM payments").get().n;
 const fee=db.prepare("SELECT default_fee FROM settings WHERE id=1").get().default_fee;
 const expected=learners*fee;
 const classes=db.prepare("SELECT c.name,COUNT(l.id) count FROM classes c LEFT JOIN learners l ON l.class_id=c.id AND l.status='Active' GROUP BY c.id ORDER BY c.id").all();
 res.json({learners,teachers,paid,expected,balance:Math.max(expected-paid,0),classes});
});

app.post("/api/change-password",auth,async(req,res)=>{const {current_password,new_password}=req.body||{};const u=db.prepare("SELECT * FROM users WHERE id=?").get(req.session.user.id);if(!u||!current_password||!new_password||new_password.length<8||!bcrypt.compareSync(current_password,u.password))return res.status(400).json({error:"Current password is incorrect or new password is too short"});db.prepare("UPDATE users SET password=? WHERE id=?").run(bcrypt.hashSync(new_password,10),u.id);res.json({ok:true})});
app.get("/api/users",auth,role("ADMIN"),(req,res)=>res.json(db.prepare("SELECT id,username,role FROM users ORDER BY username").all()));
app.post("/api/users",auth,role("ADMIN"),(req,res)=>{try{let r=db.prepare("INSERT INTO users(username,password,role) VALUES(?,?,?)").run(req.body.username,bcrypt.hashSync(req.body.password,10),req.body.role||"TEACHER");res.json({id:r.lastInsertRowid})}catch(e){res.status(400).json({error:e.message})}});
app.get("/api/settings",auth,(req,res)=>res.json(db.prepare("SELECT * FROM settings WHERE id=1").get()));
app.put("/api/settings",auth,role("ADMIN"),(req,res)=>{let s=req.body;db.prepare("UPDATE settings SET school_name=?,term=?,year=?,default_fee=?,phone=?,email=?,address=?,logo=? WHERE id=1").run(s.school_name,s.term,Number(s.year),Number(s.default_fee),s.phone||"",s.email||"",s.address||"",s.logo||null);log(req,"Updated settings");res.json({ok:true})});

app.get("/api/classes",auth,(req,res)=>res.json(db.prepare("SELECT * FROM classes ORDER BY id").all()));
app.get("/api/subjects",auth,(req,res)=>res.json(db.prepare("SELECT * FROM subjects ORDER BY id").all()));
app.get("/api/teachers",auth,(req,res)=>res.json(db.prepare("SELECT * FROM teachers ORDER BY name").all()));
app.post("/api/teachers",auth,role("ADMIN","HEADTEACHER"),(req,res)=>{try{let r=db.prepare("INSERT INTO teachers(staff_no,name,phone,email) VALUES(?,?,?,?)").run(req.body.staff_no||null,req.body.name,req.body.phone||"",req.body.email||"");log(req,"Added teacher");res.json({id:r.lastInsertRowid})}catch(e){res.status(400).json({error:e.message})}});
app.delete("/api/teachers/:id",auth,role("ADMIN","HEADTEACHER"),(req,res)=>{db.prepare("DELETE FROM teachers WHERE id=?").run(req.params.id);res.json({ok:true})});

app.get("/api/learners",auth,(req,res)=>{let q=req.query.q||"",c=req.query.class_id;let sql=`SELECT l.*,c.name class_name FROM learners l JOIN classes c ON c.id=l.class_id WHERE l.name LIKE ? OR l.admission_no LIKE ?`;let args=[`%${q}%`,`%${q}%`];if(c){sql+=" AND l.class_id=?";args.push(c)}sql+=" ORDER BY l.name";res.json(db.prepare(sql).all(...args))});
app.post("/api/learners",auth,role("ADMIN","HEADTEACHER","TEACHER"),(req,res)=>{try{let r=db.prepare(`INSERT INTO learners(admission_no,name,gender,dob,class_id,parent_name,parent_phone,address) VALUES(?,?,?,?,?,?,?,?)`).run(req.body.admission_no,req.body.name,req.body.gender||"",req.body.dob||"",req.body.class_id,req.body.parent_name||"",req.body.parent_phone||"",req.body.address||"");log(req,"Added learner");res.json({id:r.lastInsertRowid})}catch(e){res.status(400).json({error:e.message})}});
app.put("/api/learners/:id",auth,role("ADMIN","HEADTEACHER","TEACHER"),(req,res)=>{let b=req.body;db.prepare(`UPDATE learners SET admission_no=?,name=?,gender=?,dob=?,class_id=?,parent_name=?,parent_phone=?,address=?,status=? WHERE id=?`).run(b.admission_no,b.name,b.gender,b.dob,b.class_id,b.parent_name,b.parent_phone,b.address,b.status||"Active",req.params.id);res.json({ok:true})});
app.delete("/api/learners/:id",auth,role("ADMIN","HEADTEACHER"),(req,res)=>{db.prepare("UPDATE learners SET status='Inactive' WHERE id=?").run(req.params.id);res.json({ok:true})});

app.get("/api/exams",auth,(req,res)=>res.json(db.prepare("SELECT * FROM exams ORDER BY year DESC,id DESC").all()));
app.post("/api/exams",auth,role("ADMIN","HEADTEACHER"),(req,res)=>{let r=db.prepare("INSERT INTO exams(name,term,year) VALUES(?,?,?)").run(req.body.name,req.body.term,req.body.year);res.json({id:r.lastInsertRowid})});

app.get("/api/marks",auth,(req,res)=>{let a=db.prepare(`SELECT m.*,l.name learner_name,l.admission_no,s.name subject_name,e.name exam_name,c.name class_name FROM marks m JOIN learners l ON l.id=m.learner_id JOIN subjects s ON s.id=m.subject_id JOIN exams e ON e.id=m.exam_id JOIN classes c ON c.id=l.class_id WHERE m.exam_id=? AND l.class_id=? AND m.subject_id=? ORDER BY l.name`).all(req.query.exam_id,req.query.class_id,req.query.subject_id);res.json(a)});
app.post("/api/marks/bulk",auth,role("ADMIN","HEADTEACHER","TEACHER"),(req,res)=>{const st=db.prepare(`INSERT INTO marks(exam_id,learner_id,subject_id,mark) VALUES(?,?,?,?) ON CONFLICT(exam_id,learner_id,subject_id) DO UPDATE SET mark=excluded.mark`);const tx=db.transaction(rows=>rows.forEach(x=>st.run(x.exam_id,x.learner_id,x.subject_id,Math.max(0,Math.min(50,Number(x.mark))))));tx(req.body.rows||[]);log(req,"Saved marks");res.json({ok:true})});

app.get("/api/ranking",auth,(req,res)=>{
 const rows=db.prepare(`SELECT m.learner_id,l.name,l.admission_no,s.name subject,m.mark,c.name class_name FROM marks m JOIN learners l ON l.id=m.learner_id JOIN subjects s ON s.id=m.subject_id JOIN classes c ON c.id=l.class_id WHERE m.exam_id=? AND l.class_id=? ORDER BY l.name,s.name`).all(req.query.exam_id,req.query.class_id);
 const bySub={}; for(const r of rows)(bySub[r.subject]??=[]).push(r);
 for(const s of Object.keys(bySub)){bySub[s].sort((a,b)=>b.mark-a.mark);bySub[s].forEach((r,i)=>r.position=i+1)}
 const totals={};for(const r of rows){totals[r.learner_id]??={learner_id:r.learner_id,name:r.name,admission_no:r.admission_no,total:0,n:0};totals[r.learner_id].total+=r.mark;totals[r.learner_id].n++}
 const overall=Object.values(totals).map(x=>({...x,average:x.total/x.n})).sort((a,b)=>b.average-a.average);overall.forEach((x,i)=>x.position=i+1);
 res.json({subjects:bySub,overall});
});

app.get("/api/fees",auth,(req,res)=>res.json(db.prepare(`SELECT l.id,l.admission_no,l.name,c.name class_name,COALESCE(SUM(p.amount),0) paid,(SELECT default_fee FROM settings WHERE id=1) fee FROM learners l JOIN classes c ON c.id=l.class_id LEFT JOIN payments p ON p.learner_id=l.id WHERE l.status='Active' GROUP BY l.id ORDER BY l.name`).all()));
app.post("/api/payments",auth,role("ADMIN","HEADTEACHER"),(req,res)=>{try{let r=db.prepare("INSERT INTO payments(learner_id,term,year,amount,method,receipt_no,date) VALUES(?,?,?,?,?,?,?)").run(req.body.learner_id,req.body.term,req.body.year,Number(req.body.amount),req.body.method,req.body.receipt_no,new Date().toISOString().slice(0,10));log(req,"Recorded fee payment");res.json({id:r.lastInsertRowid})}catch(e){res.status(400).json({error:e.message})}});

app.get("/api/attendance",auth,(req,res)=>res.json(db.prepare(`SELECT a.*,l.name,l.admission_no FROM attendance a JOIN learners l ON l.id=a.learner_id WHERE a.date=? ORDER BY l.name`).all(req.query.date)));
app.post("/api/attendance/bulk",auth,role("ADMIN","HEADTEACHER","TEACHER"),(req,res)=>{const st=db.prepare(`INSERT INTO attendance(learner_id,date,status) VALUES(?,?,?) ON CONFLICT(learner_id,date) DO UPDATE SET status=excluded.status`);const tx=db.transaction(rows=>rows.forEach(x=>st.run(x.learner_id,x.date,x.status)));tx(req.body.rows||[]);res.json({ok:true})});

app.get("/api/report/:learner/:exam",auth,(req,res)=>{
 const l=db.prepare(`SELECT l.*,c.name class_name FROM learners l JOIN classes c ON c.id=l.class_id WHERE l.id=?`).get(req.params.learner);
 const rows=db.prepare(`SELECT s.name subject,m.mark FROM marks m JOIN subjects s ON s.id=m.subject_id WHERE m.learner_id=? AND m.exam_id=? ORDER BY s.name`).all(req.params.learner,req.params.exam);
 const all=db.prepare(`SELECT learner_id,AVG(mark) avg FROM marks m JOIN learners l ON l.id=m.learner_id WHERE m.exam_id=? AND l.class_id=? GROUP BY learner_id ORDER BY avg DESC`).all(req.params.exam,l.class_id);
 const pos=all.findIndex(x=>x.learner_id==l.id)+1;const vals=rows.map(x=>x.mark),avg=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0;
 res.json({learner:l,rows,average:avg,total:vals.reduce((a,b)=>a+b,0),position:pos,class_size:all.length});
});

app.get("/api/timetable",auth,(req,res)=>res.json(db.prepare(`SELECT t.*,c.name class_name,s.name subject_name,te.name teacher_name FROM timetable t LEFT JOIN classes c ON c.id=t.class_id LEFT JOIN subjects s ON s.id=t.subject_id LEFT JOIN teachers te ON te.id=t.teacher_id ORDER BY CASE day WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3 WHEN 'Thursday' THEN 4 ELSE 5 END,time_slot`).all()));
app.post("/api/timetable",auth,role("ADMIN","HEADTEACHER"),(req,res)=>{db.prepare("DELETE FROM timetable").run();const st=db.prepare("INSERT INTO timetable(day,time_slot,class_id,subject_id,teacher_id,activity) VALUES(?,?,?,?,?,?)");const tx=db.transaction(rows=>rows.forEach(x=>st.run(x.day,x.time_slot,x.class_id,x.subject_id,x.teacher_id||null,x.activity||null)));tx(req.body.rows||[]);res.json({ok:true})});

app.get("/api/backup",auth,role("ADMIN"),(req,res)=>{const tables=["settings","users","classes","subjects","teachers","teacher_subjects","learners","exams","marks","payments","attendance","timetable","audit"];let out={};for(const t of tables)out[t]=db.prepare(`SELECT * FROM ${t}`).all();res.setHeader("Content-Disposition","attachment; filename=kapnanda-backup.json");res.json(out)});

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(process.env.PORT||3000,()=>console.log("Kapnanda system running on port "+(process.env.PORT||3000)));
