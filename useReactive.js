import { useState, useMemo } from "react";

function getType(data) {
    return Object.prototype.toString
      .call(data)
      .replaceAll(/[\[|\]]|/g, "")
      .split(" ")[1]
      .toLowerCase();
  }
  
class CurrentGetter{
    allow = false
    value = null
    setValue = null
    catch(target,prop,self){
        if(this.allow){
            this.value = target[prop]
            this.setValue = value => self[prop] = value
        }
    }
    init(){
        this.value = null
        this.setValue = null
        this.allow = true
    }
    clear(){
        this.value = null
        this.setValue = null
        this.allow = false
    }

}

// current getter
const currentGetter = new CurrentGetter()

// 数据校验
function validType(data) {
    if (['object', 'array', 'map', 'set'].includes(getType(data))) {
        return getType(data)
    }
    return false
}

// 在 每次数据变更时 对更改数据转 proxy
const TypeConfig = {
    object: (update) => ({
        get(target, prop,self) {
            currentGetter.catch(...arguments)
            return target[prop];
        },
        set(target, prop, value) {
            target[prop] = proxyData(value);
            update();
            return true;
        },
        deleteProperty(target, prop) {
            const value = target[prop]
            delete target[prop]
            return value
        }
    }),
    array: (update) => ({
        get(target, prop, self) {
            currentGetter.catch(...arguments)
            return target[prop];
        },
        set(target, prop, value) {
            target[prop] = proxyData(value, update);
            update();
            return true;
        },
    }),
    set: (update) => ({
        get(target, prop, self) {
            // catchGetter(self,prop)
            if (['add'].includes(prop)) {
                return (value) => {
                    target.add(proxyData(value, update))
                    update()
                }
            }
            if (['delete', 'clear'].includes(prop)) {
                update()
            }
            return typeof target[prop] == 'function' ? target[prop].bind(target) : target[prop]
        },

    }),
    map: (update) => ({
        get(target, prop, self) {
            // catchGetter(target,prop,self)
            if (['set'].includes(prop)) {
                return (key, value) => {
                    target.set(key, proxyData(value))
                    update()
                }
            }
            if (['delete', 'clear'].includes(prop)) {
            }
            if (['get'].includes(prop)){
                // TODO
            }
            return typeof target[prop] == 'function' ? target[prop].bind(target) : target[prop]
        },
        set(target, prop) {
            throw 'cannot use key to set map'
        }
    })
}

// 对于 map key => value 目前只解决 value的响应
function proxyData(data, update) {
    // object array
    const type = validType(data)
    if (type === 'object') {
        Object.keys(data).forEach(key=>{
            data[key] = proxyData(data[key], update)
        })
    } 
    else if (type === 'array') {
        data.forEach((item,index)=>{
            data[index] = proxyData(data[index], update)
        })

    } 
    else if (type === 'map') {
        // 遍历·
        // clear delete set
        [...data.values()].forEach(key => {
            if (validType(data.get(key))) {
                data.set(key, proxyData(data.get(key)))
                data.delete(key)
            }
        })
    } 
    else if (type === 'set') {
        // 遍历
        // clear delete add
        [...data.values()].forEach(item => {
            if (validType(item)) {
                data.add(proxyData(item, update))
                data.delete(item)
            }
        })
    }
    return type ? new Proxy(data, TypeConfig[type](update)) : data
}

// 
export function useReactive(target) {

    // 粒度更新
    const [uniqueKey, setUniqueKey] = useState("");
    // 触发组件更新
    const update = () => setUniqueKey(Symbol(''));
    // 缓存原始数据
    const [cTarget,updateCTarget] = useState(()=>proxyData(target, update))

    // 缓存并优化 响应数据
    // const reactiveData = useMemo(()=>proxyData(cTarget, update), [cTarget])

    return [cTarget,(data)=>updateCTarget(proxyData(data,update))];
}
// 

export function useBinding(callback){
    currentGetter.init()
    callback()
    const {value,setValue} = currentGetter
    currentGetter.clear()

    return [value,setValue]
}


// useForm

