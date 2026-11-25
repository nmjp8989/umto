import importlib.util, pathlib, unittest
spec=importlib.util.spec_from_file_location("production",pathlib.Path(__file__).resolve().parents[1]/"tools/little-panth-production.py")
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
class Tracker(unittest.TestCase):
    def setUp(self):self.db={"reviews":{},"exports":[]};self.known={"005","034"};self.req={"version":1,"mode":"export","name":"vol1aesops","episodes":["005","034"],"reviews":{},"browserExports":[]}
    def test_unapproved_rejected(self):
        with self.assertRaisesRegex(ValueError,"approved first"):p.validate(self.req,self.db,self.known)
    def test_approved(self):
        self.req["reviews"]={i:{"checked":True,"approved":True,"changedAt":"2026-11-24T20:00:00.000Z"} for i in self.known}
        self.assertEqual(p.validate(self.req,self.db,self.known),("export","vol1aesops",["005","034"]))
        self.assertEqual(self.db["exports"],[])
    def test_approval_requires_check(self):
        self.req["reviews"]={"005":{"checked":False,"approved":True,"changedAt":"2026-11-24T20:00:00.000Z"}}
        with self.assertRaisesRegex(ValueError,"requires a checked"):p.validate(self.req,self.db,self.known)
    def test_existing_filename(self):
        self.db["exports"]=[{"id":"github-1","name":"VOL1AESOPS"}]
        with self.assertRaisesRegex(ValueError,"already used"):p.validate(self.req,self.db,self.known)
    def test_save_only(self):
        self.req.update(mode="save",name="",episodes=[])
        self.assertEqual(p.validate(self.req,self.db,self.known),("save","",[]))
if __name__=="__main__":unittest.main()
