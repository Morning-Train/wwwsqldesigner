/* --------------------- table manager ------------ */

SQL.TableManager = function(owner) {

	var me = this;

	this.owner = owner;
	this.dom = {
		container:OZ.$("table"),
		name:OZ.$("tablename"),
		comment:OZ.$("tablecomment")
	};
	this.selection = [];
	this.adding = false;
	
	var ids = ["addtable","removetable","aligntables","cleartables","addrow","edittable","tablekeys"];
	for (var i=0;i<ids.length;i++) {
		var id = ids[i];
		var elm = OZ.$(id);
		this.dom[id] = elm;
		elm.value = _(id);
	}

	var ids = ["tablenamelabel","tablecommentlabel"];
	for (var i=0;i<ids.length;i++) {
		var id = ids[i];
		var elm = OZ.$(id);
		elm.innerHTML = _(id);
	}
	
	
	this.select(false);
	
	this.save = this.save.bind(this);
	
	OZ.Event.add("area", "click", this.click.bind(this));
	OZ.Event.add(this.dom.addtable, "click", this.preAdd.bind(this));
	OZ.Event.add(this.dom.removetable, "click", this.remove.bind(this));
	OZ.Event.add(this.dom.cleartables, "click", this.clear.bind(this));
	OZ.Event.add(this.dom.addrow, "click", this.addRow.bind(this));
	OZ.Event.add(this.dom.aligntables, "click", this.owner.alignTables.bind(this.owner));
	OZ.Event.add(this.dom.edittable, "click", this.edit.bind(this));
	OZ.Event.add(this.dom.tablekeys, "click", this.keys.bind(this));
	OZ.Event.add(document, "keydown", this.press.bind(this));
	OZ.Event.add('area', "drop", this.droppedOnArea.bind(this));


	//On doubleclick in the main area
	OZ.Event.add("area", "dblclick", function(e){

		var table = closest(e.target, '.table');

		if(table === null){
			//We did not doubleclick a table
			//Start adding a new table at the clicked location
			me.preAdd(e);
			me.click(e);
		} else {
			//We did doubleclick a table
			//Edit the selected table
			me.edit(e);
		}

	});

	this.dom.container.parentNode.removeChild(this.dom.container);
};

SQL.TableManager.prototype.droppedOnArea = function(e) {
	e.stopImmediatePropagation();
	this.preAdd(e);
	console.log(this.dom.addtable);
	if(SQL.Row.dragged.isPrimary()){
		this.click(e);
		var draggedTable = closest(SQL.Row.dragged.dom.container, '.table');
		var nameOfDraggedTable = draggedTable.getAttribute('data-name');
		nameOfDraggedTable = pluralize.singular(nameOfDraggedTable);
		var nameOfColumn = nameOfDraggedTable+"_id";
		var newrow = this.selection[0].addRow(_(nameOfColumn));
		SQL.Designer.addRelation(SQL.Row.dragged, newrow);
	} else {
		this.click(e, true);
		console.log(this.selection[0]);
		var newTable = this.selection[0];
		var nameOfDroppedColumn = SQL.Row.dragged.getTitle();
		if (nameOfDroppedColumn.substring(nameOfDroppedColumn.length-3) == "_id")
		{
			nameOfDroppedColumn = nameOfDroppedColumn.substring(0, nameOfDroppedColumn.length-3);
		}
		nameOfDroppedColumn = pluralize.plural(nameOfDroppedColumn);
		newTable.setTitle(nameOfDroppedColumn);
		var primary = newTable.findNamedRow('id');
		SQL.Designer.addRelation(primary, SQL.Row.dragged);
	}
};

SQL.TableManager.prototype.addRow = function(e) {
	var newrow = this.selection[0].addRow(_("newrow"));
	this.owner.rowManager.select(newrow);
	newrow.expand();
};

SQL.TableManager.prototype.select = function(table, multi) { /* activate table */
	if (table) {
		if (multi) {
			var i = this.selection.indexOf(table);
			if (i < 0) {
				this.selection.push(table);
			} else {
				this.selection.splice(i, 1);
			}
		} else {
			if (this.selection[0] === table) { return; }
			this.selection = [table];
		}
	} else {
		this.selection = [];
	}
	this.processSelection();
};

SQL.TableManager.prototype.processSelection = function() {
	var tables = this.owner.tables;
	for (var i=0;i<tables.length;i++) {
		tables[i].deselect();
	}
	if (this.selection.length == 1) {
		this.dom.addrow.disabled = false;
		this.dom.edittable.disabled = false;
		this.dom.tablekeys.disabled = false;
		this.dom.removetable.value = _("removetable");
	} else {
		this.dom.addrow.disabled = true;
		this.dom.edittable.disabled = true;
		this.dom.tablekeys.disabled = true;
	}
	if (this.selection.length) {
		this.dom.removetable.disabled = false;
		if (this.selection.length > 1) { this.dom.removetable.value = _("removetables"); }
	} else {
		this.dom.removetable.disabled = true;
		this.dom.removetable.value = _("removetable");
	}
	for (var i=0;i<this.selection.length;i++) {
		var t = this.selection[i];
		t.owner.raise(t);
		t.select();
	}
};

SQL.TableManager.prototype.selectRect = function(x,y,width,height) { /* select all tables intersecting a rectangle */
	this.selection = [];
	var tables = this.owner.tables;
	var x1 = x+width;
	var y1 = y+height;
	for (var i=0;i<tables.length;i++) {
		var t = tables[i];
		var tx = t.x;
		var tx1 = t.x+t.width;
		var ty = t.y;
		var ty1 = t.y+t.height;
		if (((tx>=x && tx<x1) || (tx1>=x && tx1<x1) || (tx<x && tx1>x1)) &&
		    ((ty>=y && ty<y1) || (ty1>=y && ty1<y1) || (ty<y && ty1>y1)))
			{ this.selection.push(t); }
	}
	this.processSelection();
};

SQL.TableManager.prototype.click = function(e, preventEdit) { /* finish adding new table */
	if(typeof(preventEdit) === 'undefined'){
		preventEdit = false;
	}
	var newtable = false;
	if (this.adding) {
		this.adding = false;
		OZ.DOM.removeClass("area","adding");
		this.dom.addtable.value = this.oldvalue;
		var scroll = OZ.DOM.scroll();
		var x = e.clientX + scroll[0];
		var y = e.clientY + scroll[1];
		newtable = this.owner.addTable(_("newtable"),x,y);
		var r = newtable.addRow("id",{ai:true});
		var k = newtable.addKey("PRIMARY","");
		k.addRow(r);
	}
	this.select(newtable);
	this.owner.rowManager.select(false);
	if (this.selection.length == 1 && preventEdit === false) { this.edit(e); }
};

SQL.TableManager.prototype.preAdd = function(e) { /* click add new table */
	if (this.adding) {
		this.adding = false;
		OZ.DOM.removeClass("area","adding");
		this.dom.addtable.value = this.oldvalue;
	} else {
		this.adding = true;
		OZ.DOM.addClass("area","adding");
		this.oldvalue = this.dom.addtable.value;
		this.dom.addtable.value = "["+_("addpending")+"]";
	}
};

SQL.TableManager.prototype.clear = function(e) { /* remove all tables */
	if (!this.owner.tables.length) { return; }
	var result = confirm(_("confirmall")+" ?");
	if (!result) { return; }
	this.owner.clearTables();
};

SQL.TableManager.prototype.remove = function(e) {
	var titles = this.selection.slice(0);
	for (var i=0;i<titles.length;i++) { titles[i] = "'"+titles[i].getTitle()+"'"; }
	var result = confirm(_("confirmtable")+" "+titles.join(", ")+"?");
	if (!result) { return; }
	var sel = this.selection.slice(0);
	for (var i=0;i<sel.length;i++) { this.owner.removeTable(sel[i]); }
};

SQL.TableManager.prototype.edit = function(e) {
	this.owner.window.open(_("edittable"), this.dom.container, this.save);
	
	var title = this.selection[0].getTitle();
	this.dom.name.value = title;
	try { /* throws in ie6 */
		this.dom.comment.value = this.selection[0].getComment();
	} catch(e) {}

	/* pre-select table name */
	this.dom.name.focus();
	if (OZ.ie) {
		try { /* throws in ie6 */
			this.dom.name.select();
		} catch(e) {}
	} else {
		this.dom.name.setSelectionRange(0, title.length);
	} 
};

SQL.TableManager.prototype.keys = function(e) { /* open keys dialog */
	this.owner.keyManager.open(this.selection[0]);
};

SQL.TableManager.prototype.save = function() {
	this.selection[0].setTitle(this.dom.name.value);
	this.selection[0].setComment(this.dom.comment.value);
};

SQL.TableManager.prototype.press = function(e) {
	var target = OZ.Event.target(e).nodeName.toLowerCase();
	if (target == "textarea" || target == "input") { return; } /* not when in form field */
	
	if (this.owner.rowManager.selected) { return; } /* do not process keypresses if a row is selected */

	if (!this.selection.length) { return; } /* nothing if selection is active */

	switch (e.keyCode) {
		case 46:
			this.remove();
			OZ.Event.prevent(e);
		break;
	}
};
