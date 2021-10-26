import React, {useEffect, useState} from 'react';
import './App.css';
import {
    collection,
    addDoc,
    doc,
    setDoc,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    limit,
    serverTimestamp,
    DocumentData,
    QuerySnapshot
} from 'firebase/firestore';
import {getFirestore} from "firebase/firestore";
import {initializeApp} from 'firebase/app';

const firebaseConfig = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
    measurementId: ""
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore();

/* Firestore doesn't play very nice with typescript :) */
export interface QueueMetadata {
    currentPosition: number;
    lastInQueue: number;
}

export interface Customer {
    userName: string;
    position: number;
}

function App() {
    const [userName, setUserName] = useState("");
    const [queueName, setQueueName] = useState("myQueue"); // collection should be initialized based on queue we are working on -> each customer(corporate) gets his own queue collection
    const [queueMetaSnapshot, setQueueMetaSnapshot] = useState<QueueMetadata>({currentPosition: 0, lastInQueue: 0});
    const [queueSnapshot, setQueueSnapshot] = useState<Customer[]>([]);
    const queueCollection = collection(db, queueName);
    const metadata = doc(db, 'metadata/' + queueName);

    const queryForQueueDocs = query(
        queueCollection,
        // limit(20) // good to keep a limit in the size, but not relevant for this demo
    );

    function updateQueueInformation(queueData: QuerySnapshot<DocumentData>, currentPosition: number) {
        let customerQueue: Customer[] = [];
        queueData.forEach(customer => {
            customerQueue = ([...customerQueue, {
                userName: customer.data().userName,
                position: customer.data().position
            }]);
        });
        customerQueue = customerQueue.filter(customer => customer.position > currentPosition); // remove customers that have been served/skipped from the queue
        customerQueue.sort((a, b) => a.position - b.position); // sort queue in actual position order
        setQueueSnapshot(customerQueue);
        console.log('Setting up queue information');
        console.log(customerQueue);
    }

    useEffect(() => {
        return onSnapshot(metadata, (metaSnapshot) => {
            if (metaSnapshot.exists()) {
                getDocs(queryForQueueDocs).then(queueData => {
                        setQueueMetaSnapshot({
                            currentPosition: metaSnapshot.data().currentPosition,
                            lastInQueue: metaSnapshot.data().lastInQueue
                        });
                        updateQueueInformation(queueData, metaSnapshot.data().currentPosition)
                    },
                    err => console.error('Error fetching queue information: ', err));
                console.log('Setting queue metadata information');
                console.log(metaSnapshot.data());
            }
        });
    }, []);

    // need to somehow ensure that the effects run in order and states are written before execution proceeds (haven't figured how to avoid the second call)
    useEffect(() => {
        return onSnapshot(queryForQueueDocs, (queueData) => {
            getDoc(metadata).then(meta => {
                    if (meta.exists()) {
                        updateQueueInformation(queueData, meta.data().currentPosition);
                    }
                },
                err => console.error('Error fetching queue information: ', err));
        });
    }, []);

    const addToQueue = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        addDoc(queueCollection, {
            userName: userName,
            position: queueMetaSnapshot.lastInQueue + 1,
            timestamp: serverTimestamp()
        }).then(
            docRef => {
                //update queue metadata
                let newMetaSnapshot = {
                    currentPosition: queueMetaSnapshot.currentPosition,
                    lastInQueue: queueMetaSnapshot.lastInQueue + 1
                };
                setDoc(metadata, newMetaSnapshot).then(() => console.log('Updated metadata snapshot with new queue entry'), err => console.error('Could not update metadata snapshot: ', err));
                console.log('Document written with id: ', docRef.id);
            },
            err => console.error('Error adding customer to queue: ', err)
        );
        setUserName(""); // reset form
    }

    return (
        <div className="App">
            <header className="App-header">
                <span>MyQueue App</span>
                <div>
                    <form onSubmit={addToQueue}>
                        <input className="input-field" type="text" name="userName" placeholder="User name"
                               onChange={(e) => setUserName(e.target.value)} value={userName}/>
                        <button className='button-base' type="submit"> Add me to queue</button>
                    </form>
                </div>
                <h2> Currently waiting: </h2>
                <table id="queueData">
                    <tbody>
                    {queueSnapshot && queueSnapshot.map((customer, customerIdx) => <tr key={customerIdx}>
                        <td>{customer.userName}</td>
                    </tr>)}
                    </tbody>
                </table>
            </header>
        </div>
    );
}

export default App;
