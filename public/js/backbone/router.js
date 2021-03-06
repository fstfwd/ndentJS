var CURRENT_TIMESTAMP; 
var socket = null; 

var AppRouter = Backbone.Router.extend({

	socketEvents: _.extend({}, Backbone.Events),

	routes: {
		'': 'initialize', 
		':id': "viewRoot"
	}, 

	initialize: function(){ 
		this.socketInitialize();
	},

	socketInitialize: function(){
		if(socket){ return; }//prevents double-initialization. 
		socket = io.connect(); 
		this.setUpSocket(); 
		
		$.ajax({
			url: "/ajaxlogin", 
			type: "POST", 

			complete: function(){
			},
			success: function(data){
				// console.log("AjaxLoginDATA"); 
				if(typeof data == "string"){
					$("textarea").attr("disabled", true); 
				} //User is not logged in. 
				if(typeof data == "object"){//we've got the userObject. 
					$("#googleButton").parent().html("<a href='logout'>Logout</a> "); 
					socket.emit("logIn", data); //logs the user into the socket.


					data.google.id = null; //why?
					data.google.token = null; 
					data.google.email = null; 
					CurrentUser = data;  
				}
			},
			error: function(data){
				console.log("ERROR- AjaxLoginDATA");
			}
	    });//ajax
	}, 

	viewRoot: function(id, snapCollection){

		var rootModel; 
		var metaCollection; 
		var snapView = 0;

		if(snapCollection){
			rootModel = snapCollection.findWhere({cur_id: id});
			metaCollection = snapCollection
			snapView = 1; 
		}
		else{
			rootModel = nodesCollection.findWhere({_id: id});
			metaCollection = nodesCollection; 
		}
		var rootView = new listView({
				depth: -1,
				model: rootModel, 
				metaCollection: metaCollection,
				snapView: snapView
			})
		$(".main1").html(rootView.render().$el); 
		this.changeView(rootView);
	}, 

	changeView: function(view) {
     	if ( this.currentView != null ) {
        	this.currentView.undelegateEvents();
      	}
      	
      	this.currentView = view;
      	$("textarea").textareaAutoExpand(); 
    }, 

    viewSearchSubset: function(matchedNodes){
    	console.log("matchedNodes", matchedNodes); 
    	var SUBSET = matchedNodes

    	augmentedSet = []
		_.each(SUBSET, function(matchedNode){
			augmentedSet.push([matchedNode.get("_id")]); 
			augmentedSet.push(matchedNode.getAncestry()); 
		});
		var finalSet = _.union(_.flatten(augmentedSet));
		var rootView = new listView({
				depth: -1,
				model: nodesCollection.findWhere({_id: $('.root').attr('data-id')}),
				metaCollection: nodesCollection,
				snapView: 0 , 
				searchSet: finalSet
			})
		$(".main1").html(rootView.render().$el); 
		this.changeView(rootView);
    }, 

















setUpSocket: function(){
var that = this; 

socket.emitWrapper = function(eventName, data){
	// console.log(this); 
	if(this.socket.connected){
		if(eventName=="newNode" || eventName=="movedNode" || eventName=="removeNode"){
			var oldTime = CURRENT_TIMESTAMP; 
			CURRENT_TIMESTAMP = Date.now();
			this.emit(eventName, data, [CURRENT_TIMESTAMP, oldTime]); 
			return;
		}
		this.emit(eventName, data); 
	}
	else{ //(alert + lock)
		alert("Internet connection down. Edits not synced. Refresh when back online."); 
	}
}

socket.on('nodeData', function(data, SERVER_TIMESTAMP){
	//alert("data");
	CURRENT_TIMESTAMP = SERVER_TIMESTAMP; 
	console.log(data[0]);
	nodesCollection = new NodesCollection(data); 
	var id = nodesCollection.findWhere({text: "0root"}).get("_id");
	// if(otherID){
	// 	id = otherID
	// }
	that.viewRoot(id);
});


socket.on("commitReceived", function(){
	alert("commitReceived"); 
}); 

socket.on("revHistory", function(data){
	alert("revHistory!!"); 
	console.log("revHistory!!"); 
	snapHash = data[0]; 
	timeHash = data[1]; 
	console.log("snapHash"); 
	console.log(snapHash); 
	console.log("timeHash"); 
	console.log(timeHash); 

	var list = ""; 
	_.each(Object.keys(timeHash).sort(), function(timestamp){
		list += "<li><a class='timestamp'>"+timestamp+"</a></li>"; 
	})

	$("#revTimestamps").html(list); 
}); 

UserHash = {};  
socket.on("UserList", function(data){
	_.each(data, function(user){
		UserHash[user._id] = user.google.name; 
	}); 
}); 

socket.on('edit', function(data){
	var id = data[0];
	var newText = data[1];
	
	var curModel = nodesCollection.findWhere({_id: id})
	curModel.set("text", newText);
	_.each(curModel.get("views"), function(view){
		view.updateText(newText);
		
	});

});

socket.on("updateReceived", function(data){
	//data[0] is _id. data[1] is instance. 
	var instance = data[1];
	var old_id = data[0];
	var parId = data[2][0];
	var newIndex = data[2][1];

	var parentModel = nodesCollection.findWhere({_id: parId});
	var new_id = instance._id
	var oldModel = nodesCollection.findWhere({ _id: old_id }); 
	oldModel.set("_id", new_id );
	_.each(oldModel.get("views"), function(view){
		view.updateId(new_id);
	});
	parentModel.get("children")[newIndex] = instance._id;
})

socket.on("newNode", function(data, newTime){
	//need the instance + the index. 
	var modelJson = data[1]; //(includes the negative ID to find later);
	var parId = data[0][0];
	var newIndex = data[0][1];
	CURRENT_TIMESTAMP = newTime; 

	var newNode = new NodeModel(modelJson);
	nodesCollection.add(newNode);
	var parentModel = nodesCollection.findWhere({_id: parId});
	var parentViews = parentModel.get("views");
	_.each(parentViews, function(parentView){
		parentView.addNode(newNode, newIndex).lock();
		//look at socket.emit("newNode" to see why -1);
	}); 
	parentModel.get("children").insert(newIndex, modelJson._id); 
});

socket.on("editing", function(data){
	var id = data[0]; 
	var authorName = data[1]; 
	console.log("EDITING RECEIVED + ID");
	console.log(id, authorName);
	if(id < 0){return;} //(ID is updated later) //(newNode is called);
	var tempViews = nodesCollection.findWhere({_id: id}).get("views");
	_.each(tempViews, function(tempView){
		tempView.lock(authorName);
	}); 
}); 

socket.on("blurred", function(data){
	var id = data[0];
	var tempModel = nodesCollection.findWhere({_id: id}); 
	// alert("blurred"); 
	console.log("blurred"); 
	console.log(data); 
	if(data[1] != null){
		var text = data[1];
		var author = data[2]; 
		
		
		tempModel.set("text", text);
		tempModel.set("author", author);
	}

	var tempViews = tempModel.get("views");
	_.each(tempViews, function(tempView){
		tempView.unlock();
		tempView.updateText(text);
	}); 
});

socket.on("removeNode", function(data, newTime){
	var tempVo = {}; //PROTECTING STATE!!
	CURRENT_TIMESTAMP = newTime; 

	// tempVo.author = data[3]; //(actually, unnecessary...)
	tempVo.thisId = data[0];
    tempVo.thisIndex = data[1];
    tempVo.parentId = data[2]; 
    tempVo.thisModel = nodesCollection.findWhere({_id: tempVo.thisId});
    tempVo.parentModel = nodesCollection.findWhere({_id: tempVo.parentId});
    
    
    removeNode(tempVo, true); //true means came from broadcast.  
});

socket.on("movedNode", function(data, newTime){
	CURRENT_TIMESTAMP = newTime; 
	var ids = data[0];
	var indices = data[1];
	var author = data[2]; 

	var thisModel = nodesCollection.findWhere({_id: ids[0]});
	var oldParModel = nodesCollection.findWhere({_id: ids[1]});
	var newParModel = nodesCollection.findWhere({_id: ids[2]});


	thisModel.set("author", author); 
	moveNode(thisModel, indices[0], oldParModel, newParModel, indices[1]);
}); 


socket.on("revControl", function(data){
	//(store all of this...). 
	var timeHash = data[0]; 
	var snapHash = data[1]; 
	var timeStamps = timeHash.keys; 

	//To be continued...
}); 

socket.on("OFF_SYNC", function(){
	alert("syncing error.Edits no longer synced. Please refresh browser"); 
	socket = null;  
}); 

// socket.on("VALIDATE", function(data){
// 	var parId = data[0]; 
// 	var parArr = data[1]; 
// 	var thisParArr = nodesCollection.findWhere({_id: parId}).get("children"); 
// 	if(!_.isEqual(thisParArr, parArr)){
// 		alert("syncing error.Edits no longer synced. Please refresh browser"); 
// 		socket = null;  
// 	}
// });


socket.emit("nodeRequest"); 
}

});//endAppRouter. 

	


// socket.on('nodeData', function(data){
// 	console.log("nodeDATA RECEIVED\n");
// 	console.log(data);
// 	nodesCollection = new nodesCollection(data); //nodes
// 	//alert(data);
// 	var model = new NodeModel(data[1]);
// 	console.log("NodeModel(data[1])\n");
// 	console.log(model);
// 	console.log("nodesCollection.models");
// 	console.log(nodesCollection.models);
// 	var rootNode = nodesCollection.findWhere({_id: "52b7422c36dd4c5215ce78bf"});
// 	console.log("rootNode");
// 	console.log(rootNode);
// 	//console.log(rootNode);
// 	that.viewRoot("52b7422c36dd4c5215ce78bf")
// });