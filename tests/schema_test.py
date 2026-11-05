import sqlite3,pathlib,unittest
class Ownership(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:');self.db.executescript(pathlib.Path('architecture/schema.sql').read_text())
  self.db.executemany('INSERT INTO profiles(owner_id) VALUES (?)',[('A',),('B',)])
  self.db.execute("INSERT INTO directions(owner_id,id,name) VALUES ('A','private','English')")
  self.db.execute("INSERT INTO habits(owner_id,id,title,target) VALUES ('A','habit','Yoga',2)")
 def test_cross_owner_direction_rejected(self):
  with self.assertRaises(sqlite3.IntegrityError): self.db.execute("INSERT INTO tasks(owner_id,id,direction_id,title,bucket) VALUES ('B','task','private','Wrong','soon')")
 def test_cross_owner_habit_rejected(self):
  with self.assertRaises(sqlite3.IntegrityError): self.db.execute("INSERT INTO habit_marks VALUES ('B','habit','2026-11-04')")
 def test_duplicate_mark_rejected(self):
  self.db.execute("INSERT INTO habit_marks VALUES ('A','habit','2026-11-04')")
  with self.assertRaises(sqlite3.IntegrityError): self.db.execute("INSERT INTO habit_marks VALUES ('A','habit','2026-11-04')")
 def test_scoped_read(self):
  self.assertEqual(self.db.execute('SELECT id FROM directions WHERE owner_id=?',('B',)).fetchall(),[])
if __name__=='__main__':unittest.main()
